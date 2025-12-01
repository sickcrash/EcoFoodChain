export const Home = (): JSX.Element => {
  return (
    <section className="flex flex-col items-center justify-start h-dvh p-8 bg-gray-50 dark:bg-gray-900">
      {/* Titolo */}
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
        Benvenuto su SmartField – Come iniziare
      </h1>

      {/* Box tutorial */}
      <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 space-y-4">
        <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-200">
          <li>
            <strong>Dashboard:</strong> Sulla sidebar a sinistra, premi su <strong>Dashboards</strong> per vedere tutte le culture disponibili.
          </li>
          <li>
            <strong>Selezione cultura:</strong> Dopo aver cliccato <strong>Dashboards</strong> seleziona la cultura che ti interessa per visualizzare i dati dei sensori.
          </li>
          <li>
            <strong>Chatbot:</strong> Per parlare con il chatbot, prima seleziona la cultura desiderata, poi premi sull’icona del robot in basso a destra per iniziare la chat.
          </li>
        </ol>

        <p className="mt-4 text-gray-600 dark:text-gray-400">
          <li>
            <strong>Logout:</strong> Usa il pulsante in alto a destra per uscire dalla piattaforma.
          </li>
          <li>
            <strong>Tema:</strong> Cambia il tema tra chiaro e scuro cliccando sull’icona della luna o del sole.
          </li>
          Ora sei pronto per esplorare i tuoi campi con SmartField!
        </p>
      </div>
    </section>
  );
};
