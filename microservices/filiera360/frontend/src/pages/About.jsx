import React from 'react';

const About = () => {
  return (
    <div
      className="container mt-5"
      style={{ width: '50%' }}
    >
      <h3>ℹ️ Informazioni e Disclaimer</h3>
      <p>
        Questa piattaforma è stata sviluppata a scopo di ricerca nell’ambito di un progetto del{' '}
        <b>Politecnico di Bari</b>. Per informazioni contattare i responsabili di progetto <b>Alessio Lorè</b> (
        <u>a.lore2@studenti.poliba.it</u>) e <b>Tiziano Albore</b> (<u>t.albore@studenti.poliba.it</u>). Si tratta di un
        prototipo sperimentale in fase di sviluppo, soggetto a frequenti aggiornamenti. Pertanto, la piattaforma
        potrebbe presentare difetti, malfunzionamenti o vulnerabilità.
      </p>
      <h3>⚠️ Limitazione di Responsabilità</h3>
      <p>
        Gli sviluppatori non si assumono alcuna responsabilità per eventuali perdite di dati, fuga di credenziali, danni
        derivanti dall’uso della piattaforma o problemi di sicurezza. Gli utenti sono consapevoli che stanno utilizzando
        un ambiente sperimentale e accettano i potenziali rischi connessi. Per le ragioni citate nel paragrafo
        precedente, l'utilizzo della piattaforma non è stato testato in maniera sufficiente per l'utilizzo commerciale,
        né per l'impiego in contesti di produzione o per finalità operative reali.
      </p>
      <h3>🔐 Sicurezza e Dati Sensibili</h3>
      <p>
        Poiché questa piattaforma è in fase di test, sconsigliamo di utilizzare credenziali reali o dati sensibili. Se
        decidi di farlo, lo fai a tuo rischio e pericolo. I dati inseriti potrebbero non essere protetti in modo
        adeguato e potrebbero essere persi, compromessi o esposti a terzi. Gli sviluppatori non sono responsabili di
        eventuali violazioni di sicurezza derivanti dall’utilizzo della piattaforma.
      </p>

      <h3>📜 Conformità al GDPR e Trattamento dei Dati</h3>
      <p>
        In conformità con il Regolamento (UE) 2016/679 (GDPR), i dati raccolti dalla piattaforma sono trattati
        esclusivamente per finalità di ricerca accademica e non saranno condivisi con terze parti per scopi commerciali
        o di profilazione. Gli utenti hanno il diritto di:
        <br />
        Richiedere la cancellazione dei dati forniti contattando gli sviluppatori ai recapiti sopra indicati.
        <br />
        Ottenere informazioni sul trattamento dei propri dati e su eventuali misure di sicurezza applicate.
        <br />
        L’utilizzo della piattaforma implica l’accettazione di queste condizioni. Se non accetti, ti invitiamo a non
        utilizzare il servizio.
      </p>
    </div>
  );
};

export default About;
