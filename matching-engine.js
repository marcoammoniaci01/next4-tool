// ─── MOTORE DI MATCHING CONDIVISO (dashboard interna + tool pubblico) ────────
// Estratto da dashboard_bandi.html. Usato sia dalla dashboard (con accesso a
// BANDI_REQUISITI_MAP/parseRequisitiFromNote, definiti solo lì) sia dal tool
// pubblico in portale/ (dove quei due NON esistono — il dataset pubblico porta
// sempre requisiti già risolti, quindi i fallback sotto restano dormienti lì).

// Controlla se un cliente soddisfa i requisiti di ammissibilità di un bando.
// Restituisce { ok, reasons, reasonsHard, reasonsSoft }.
// reasonsHard = condizioni non superabili nel breve periodo (dimensione, ATECO,
//   età, soglie massime, cause di inammissibilità di legge).
// reasonsSoft = condizioni superabili (iscrizioni, crescita, attesa, nuova sede).
// Se requisiti è vuoto o il campo cliente non è compilato → non blocca il match.
function matchClienteBando(nomeCliente, bando) {
  const d   = CLIENTI[nomeCliente] || {};
  // Usa i requisiti salvati; se assenti, prova a parsarli dalla descrizione (bandi pre-esistenti)
  const req = (bando && bando.requisiti)
           || (typeof BANDI_REQUISITI_MAP !== 'undefined' && bando && BANDI_REQUISITI_MAP[bando.nome])
           || (typeof parseRequisitiFromNote === 'function' && parseRequisitiFromNote(bando && bando.descrizione))
           || {};
  const reasons = [];
  const reasonsHard = [];
  const reasonsSoft = [];
  const pushHard = msg => { reasons.push(msg); reasonsHard.push(msg); };
  const pushSoft = msg => { reasons.push(msg); reasonsSoft.push(msg); };
  const annoOggi = new Date().getFullYear();

  if (req.dimensioni && req.dimensioni.length > 0 && d.dimensione)
    if (!req.dimensioni.includes(d.dimensione))
      pushHard(`Dimensione: serve ${req.dimensioni.join('/')} (questa è ${d.dimensione})`);

  if (req.startupInnovativa && !d.startupInnovativa)
    pushSoft('Richiede iscrizione come Startup Innovativa');

  if (req.pmiInnovativa && !d.pmiInnovativa)
    pushSoft('Richiede iscrizione come PMI Innovativa');

  if (req.impresaFemminile && !d.impresaFemminile)
    pushSoft('Richiede requisito di impresa femminile');

  if (req.impresaGiovanile && !d.impresaGiovanile)
    pushSoft('Richiede requisito di impresa giovanile');

  if (req.atecoInclude && req.atecoInclude.length > 0 && d.ateco)
    if (!req.atecoInclude.some(p => d.ateco.startsWith(p)))
      pushHard(`ATECO ${d.ateco} non tra i codici ammessi (${req.atecoInclude.join(', ')})`);

  if (req.atecoExclude && req.atecoExclude.length > 0 && d.ateco)
    if (req.atecoExclude.some(p => d.ateco.startsWith(p)))
      pushHard(`ATECO ${d.ateco} escluso dal bando`);

  if (req.etaMinAnni != null && d.annoFondazione != null) {
    const eta = annoOggi - d.annoFondazione;
    if (eta < req.etaMinAnni) pushHard(`Impresa troppo giovane: ${eta} anni (min ${req.etaMinAnni})`);
  }
  if (req.etaMaxAnni != null && d.annoFondazione != null) {
    const eta = annoOggi - d.annoFondazione;
    if (eta > req.etaMaxAnni) pushHard(`Impresa troppo anziana: ${eta} anni (max ${req.etaMaxAnni})`);
  }
  if (req.addettiMin != null && d.addetti != null && d.addetti < req.addettiMin)
    pushSoft(`Troppo pochi addetti: ${d.addetti} (min ${req.addettiMin})`);
  if (req.addettiMax != null && d.addetti != null && d.addetti > req.addettiMax)
    pushHard(`Troppi addetti: ${d.addetti} (max ${req.addettiMax})`);
  if (req.fatturatoMin != null && d.fatturatoUltimo != null && d.fatturatoUltimo < req.fatturatoMin)
    pushSoft(`Fatturato insufficiente: €${d.fatturatoUltimo.toLocaleString('it-IT')} (min €${req.fatturatoMin.toLocaleString('it-IT')})`);
  if (req.fatturatoMax != null && d.fatturatoUltimo != null && d.fatturatoUltimo > req.fatturatoMax)
    pushHard(`Fatturato troppo alto: €${d.fatturatoUltimo.toLocaleString('it-IT')} (max €${req.fatturatoMax.toLocaleString('it-IT')})`);

  // Bilanci approvati (check generico — funziona per tutti i bandi con bilanciMin impostato)
  if (req.bilanciMin != null) {
    if (d.bilanciApprovati != null && d.bilanciApprovati < req.bilanciMin)
      pushSoft(`Troppo pochi bilanci approvati: ${d.bilanciApprovati} (richiesti almeno ${req.bilanciMin})`);
    else if (d.bilanciApprovati == null && d.annoFondazione != null) {
      const stimaBilanci = Math.max(0, annoOggi - d.annoFondazione - 1);
      if (stimaBilanci < req.bilanciMin)
        pushSoft(`Probabilmente bilanci insufficienti: ~${stimaBilanci} stimati (richiesti almeno ${req.bilanciMin}; fondata ${d.annoFondazione})`);
    }
  }
  if (req.bilanciMax != null && d.bilanciApprovati != null && d.bilanciApprovati > req.bilanciMax)
    pushHard(`Troppi bilanci depositati: ${d.bilanciApprovati} (max ${req.bilanciMax})`);

  // Numero soci
  if (req.sociMin != null && d.nSoci != null && d.nSoci < req.sociMin)
    pushSoft(`Troppo pochi soci: ${d.nSoci} (richiesti almeno ${req.sociMin})`);
  if (req.sociMax != null && d.nSoci != null && d.nSoci > req.sociMax)
    pushHard(`Troppi soci: ${d.nSoci} (max ${req.sociMax})`);

  // Condizioni di inammissibilità (regime de minimis, impresa in difficoltà, procedure concorsuali)
  if (req.deMinimisMassimale != null && d.aiutiRicevuti != null && d.aiutiRicevuti >= req.deMinimisMassimale)
    pushHard(`Massimale de minimis già raggiunto: €${d.aiutiRicevuti.toLocaleString('it-IT')} ricevuti (soglia €${req.deMinimisMassimale.toLocaleString('it-IT')})`);
  if (req.escludeImpresaDifficolta && d.impresaInDifficolta)
    pushHard('Bando escluso per imprese in difficoltà (Reg. UE 651/2014, art. 2 punto 18)');
  if (req.escludeProcedureConcorsuali && d.procedureConcorsuali)
    pushHard('Bando escluso per imprese in liquidazione o soggette a procedure concorsuali');

  // SIMEST: check fatturato zero (il bilanci check è ora gestito via bilanciMin in BANDI_REQUISITI_MAP)
  if (bando && /^SIMEST/i.test(bando.nome)) {
    if (req.bilanciMin == null) {
      // Fallback per bandi SIMEST non ancora in BANDI_REQUISITI_MAP
      if (d.bilanciApprovati != null && d.bilanciApprovati < 2)
        pushSoft(`SIMEST richiede almeno 2 bilanci approvati (${d.bilanciApprovati} depositati)`);
      else if (d.bilanciApprovati == null && d.annoFondazione != null && (annoOggi - d.annoFondazione) < 2)
        pushSoft('SIMEST richiede almeno 2 bilanci approvati (impresa troppo giovane)');
    }
    if (d.fatturatoUltimo != null && d.fatturatoUltimo === 0)
      pushHard('SIMEST non ammissibile: fatturato zero');
  }

  return { ok: reasons.length === 0, reasons, reasonsHard, reasonsSoft };
}

function autoMatchClienti(regione) {
  const r = (regione || '').toLowerCase();

  // Regioni italiane → province/città associate
  const GEO = {
    lazio:      ['roma','viterbo','frosinone','latina','rieti','(rm)','(vt)','(fr)','(lt)','(ri)'],
    lombardia:  ['milano','bergamo','brescia','como','cremona','lecco','lodi','mantova','monza','pavia','sondrio','varese','(mi)','(bg)','(bs)','(co)','(cr)','(lc)','(lo)','(mn)','(mb)','(pv)','(so)','(va)'],
    toscana:    ['firenze','arezzo','grosseto','livorno','lucca','massa','pisa','pistoia','prato','siena','(fi)','(ar)','(gr)','(li)','(lu)','(ms)','(pi)','(pt)','(po)','(si)'],
    campania:   ['napoli','avellino','benevento','caserta','salerno','(na)','(av)','(bn)','(ce)','(sa)'],
    sicilia:    ['palermo','agrigento','caltanissetta','catania','enna','messina','ragusa','siracusa','trapani','(pa)','(ag)','(cl)','(ct)','(en)','(me)','(rg)','(sr)','(tp)'],
    veneto:     ['venezia','belluno','padova','rovigo','treviso','verona','vicenza','(ve)','(bl)','(pd)','(ro)','(tv)','(vr)','(vi)'],
    piemonte:   ['torino','alessandria','asti','biella','cuneo','novara','verbania','vercelli','(to)','(al)','(at)','(bi)','(cn)','(no)','(vb)','(vc)'],
    'emilia':   ['bologna','ferrara','forlì','modena','parma','piacenza','ravenna','reggio emilia','rimini','(bo)','(fe)','(fc)','(mo)','(pr)','(pc)','(ra)','(re)','(rn)'],
    puglia:     ['bari','brindisi','foggia','lecce','taranto','(ba)','(bt)','(br)','(fg)','(le)','(ta)'],
    calabria:   ['catanzaro','cosenza','crotone','reggio calabria','vibo valentia','(cz)','(cs)','(kr)','(rc)','(vv)'],
    sardegna:   ['cagliari','nuoro','oristano','sassari','(ca)','(nu)','(or)','(ss)','(su)'],
    abruzzo:    ["l'aquila",'chieti','pescara','teramo','(aq)','(ch)','(pe)','(te)'],
    basilicata: ['potenza','matera','(pz)','(mt)'],
    molise:     ['campobasso','isernia','(cb)','(is)'],
    umbria:     ['perugia','terni','(pg)','(tr)'],
    marche:     ['ancona','ascoli','fermo','macerata','pesaro','(an)','(ap)','(fm)','(mc)','(pu)'],
    liguria:    ['genova','imperia','la spezia','savona','(ge)','(im)','(sp)','(sv)'],
    friuli:     ['trieste','gorizia','pordenone','udine','(ts)','(go)','(pn)','(ud)'],
    trentino:   ['trento','bolzano','(tn)','(bz)'],
    // Mezzogiorno = macro-area
    mezzogiorno:['campania','puglia','basilicata','calabria','sicilia','sardegna','abruzzo','molise',
                 'napoli','bari','palermo','catanzaro','potenza','cosenza','catania','cagliari','pescara','campobasso',
                 '(na)','(ba)','(pa)','(cz)','(pz)','(cs)','(ct)','(ca)','(pe)','(cb)',
                 '(av)','(bn)','(ce)','(sa)','(bt)','(br)','(fg)','(le)','(ta)','(kr)','(rc)','(vv)',
                 '(nu)','(or)','(ss)','(su)','(aq)','(ch)','(te)','(mt)','(ag)','(cl)','(en)','(me)','(rg)','(sr)','(tp)'],
  };

  // Cerca la regione nel testo
  let keywords = [];
  for (const [key, cities] of Object.entries(GEO)) {
    if (r.includes(key)) { keywords = cities; break; }
  }
  const isNazionale = !keywords.length || ['nazionale','tutte','italia','tutto il territorio'].some(k => r.includes(k));

  const out = [];
  for (const [nome, dati] of Object.entries(CLIENTI)) {
    if (!dati.piva) continue; // salta aziende senza P.IVA (dati incompleti)
    if (isNazionale) {
      out.push(nome);
    } else {
      const cittaLC = (dati.citta || '').toLowerCase();
      const sediExtra = (dati.regioniOperative || []).map(r => r.toLowerCase());
      const inRegione = keywords.some(k => cittaLC.includes(k))
                     || sediExtra.some(r => keywords.some(k => r.includes(k)));
      out.push(inRegione ? nome : nome + ' *');
    }
  }
  return out.sort();
}

// Controlla se la regione del bando è compatibile con le regioni di un profilo
// (azienda reale o sintetico, non richiede che sia in CLIENTI). Generalizzazione
// di _rqGeoOk del wizard interno — usata sia lì che dal tool pubblico.
function matchGeografico(bandoRegione, userRegioni) {
  const br = (bandoRegione || '').toLowerCase();
  if (!br || ['nazionale', 'tutte', 'tutto il territorio', 'italia'].some(k => br.includes(k))) return 'nazionale';
  const MEZZ = ['campania','puglia','basilicata','calabria','sicilia','sardegna','abruzzo','molise','campobasso','(na)','(ba)','(pa)','(cz)','(pz)','(cs)','(ct)','(ca)','(pe)','(rc)','(kr)'];
  for (const r of (userRegioni || []).filter(Boolean)) {
    const rl = r.toLowerCase().trim();
    if (!rl) continue;
    if (br.includes(rl) || rl.split(' ').some(w => w.length > 3 && br.includes(w))) return 'in';
    if (br.includes('mezzogiorno') && MEZZ.some(m => rl.includes(m.replace('(', '').replace(')', '')))) return 'in';
  }
  return 'fuori';
}

// Classifica l'esito combinato di matchClienteBando + matchGeografico in tre
// livelli di fiducia per il tool pubblico:
//  - 'idoneo': nessun motivo hard né soft, geo non 'fuori'
//  - 'soft':   nessun motivo hard, ma ≥1 motivo soft e/o sede fuori regione
//              (azioni concrete per diventare idoneo)
//  - 'escluso': ≥1 motivo hard (condizione non superabile nel breve periodo)
function classificaEsito(matchResult, geo) {
  const reasonsHard = (matchResult && matchResult.reasonsHard) || [];
  const reasonsSoft = (matchResult && matchResult.reasonsSoft) || [];

  if (reasonsHard.length > 0) return { livello: 'escluso', azioni: [] };

  const azioni = reasonsSoft.slice();
  if (geo === 'fuori') azioni.push('Apri una sede operativa nella regione del bando');

  return { livello: azioni.length > 0 ? 'soft' : 'idoneo', azioni };
}
