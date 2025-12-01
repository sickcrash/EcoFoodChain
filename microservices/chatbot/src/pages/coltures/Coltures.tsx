import { Droplet, LoaderCircle, MapPin, Thermometer, Wind } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { CardInfo } from '@/components';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui';
import { SignalData, WeatherForecastModel } from '@/models';
import { LandModel } from '@/models/land-model';
import { getTimeAgo } from '@/utils';
import { useChartsQuery, useDevicesQuery, useSignalsQuery, useWeatherQuery } from '@hooks/index';

const REFRESH_INTERVAL = 2.5 * 60 * 1000; // 5 minutes in milliseconds

export const Coltures = (): JSX.Element => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [landData, setLandData] = useState<LandModel>(); // coltureData, stato che conterrà i dati della coltura ottenuti dalla API.
  const [weatherForecastData, setWeatherForecastData] = useState<WeatherForecastModel>();

  // TODO: Implementare la logica per il colore della predizione quando le stesse saranno attive
  /*  const predictionColor = useMemo(() => { // useMemo si usa per calcolare il valore solo quando coltureData.predizione cambia
    switch (coltureData?.predizione.toLowerCase()) {
      case 'produzione ottimale':
        return 'bg-green-500';
      case 'produzione sufficiente':
        return 'bg-orange-500';
      case 'produzione critica':
        return 'bg-red-500';
    }
  }, [coltureData?.predizione]); */

  const location = useLocation(); // Estrae dalla URL il parametro relativo alla coltura (es.se URL è /colture/pomodori, estrae "pomodori").

  const { getSignals } = useSignalsQuery(); // getCulture, estratto dal hook "useCulturesQuery" per ottenere i dati della coltura dal back end.
  const { getWeatherForecast } = useWeatherQuery(); // getWeatherForecast, come getCulture, ma per ottenere le previsioni meteo.
  const { getCharts } = useChartsQuery(); // useChartsQuery, hook per ottenere i dati per i grafici.
  const { getDevice } = useDevicesQuery(); // useDevicesQuery, hook per ottenere i dati dei dispositivi.

  const searchAll = useCallback(async () => { // Callback assicura che la funzione venga ricreata solo se cambiano le dipendenze.
    setIsLoading(true);

    const land = decodeURI(location.pathname.split('/')[2]).toLowerCase(); // Estrae il nome della coltura dalla URL.

    const { data: signals } = await getSignals(land); // Ottiene i segnali relativi alla coltura.

    if (!signals || signals.length === 0) {
      setIsLoading(false);
      return;
    }

    const { data: device } = await getDevice(land);

    if (!device) {
      setIsLoading(false);
      return;
    }

    const date = new Date();
    const now = date.toString();
    date.setHours(date.getHours() - 1);

    const chartsMap = new Map<string, SignalData[]>();
    // Utilizza un Map per memorizzare i dati dei grafici, dove la chiave è l'ID del segnale e il valore è un array di SignalData.
    signals.forEach(signal => {
      chartsMap.set(signal._id, []); // Inizializza l'array per ogni segnale.
    });

    const chartsPromises = signals.map(async signal => {
      const { data } = await getCharts({
        startDate: signal.last_conn,
        endDate: now,
        granularity: 'a',
        signals: [signal._id]
      });

      if (!data) {
        return;
      }

      const chartData = data[signal._id] as SignalData[]; // Ottiene i dati del grafico per il segnale corrente.
      chartsMap.set(signal._id, chartData); // Aggiunge i dati del grafico alla mappa.
    });

    await Promise.all(chartsPromises); // Attende che tutte le promesse siano risolte.

    if (!chartsMap.size) {
      setIsLoading(false);
      return;
    }

    setLandData({
      name: land,
      signals: signals
        .map(signal => {
          const chartData = chartsMap.get(signal._id); // Ottiene i dati del grafico per il segnale corrente.

          if (!chartData || chartData.length === 0) {
            return null;
          }

          return {
            name: signal.description,
            value: `${chartData[0].value.toFixed(2)} ${signal.unit_readable}`,
            lastConnection: getTimeAgo(chartData[0].last_conn),
          };
        })
        .filter(signal => signal !== null) as {
          name: string;
          value: string;
          lastConnection: string;
         }[],
      lat: device.location.coordinates[1],
      long: device.location.coordinates[0],
    });

    const { data: weatherForecastData } = await getWeatherForecast({
      lat: device.location.coordinates[1],
      long: device.location.coordinates[0],
    });

    setWeatherForecastData(weatherForecastData); // Aggiorna lo stato weatherForecastData con le previsioni meteo.

    setIsLoading(false);
  }, [getCharts, getDevice, getSignals, getWeatherForecast, location.pathname]);

  const getIcon = useCallback((title: string) => { // per restituire icona
    switch (title) {
      case 'temperatura':
        return <Thermometer className="h-4 w-4" />;
      case 'umidità':
        return <Droplet className="h-4 w-4" />;
      case 'vento':
        return <Wind className="h-4 w-4" />;
      default:
        return null;
    }
  }, []);

  const getData = useCallback((title: string, value: number) => { // aggiunge unità appropriata ai valori
    switch (title) {
      case 'temperatura':
        return `${value}°C`;
      case 'umidità':
        return `${value}%`;
      case 'vento':
        return `${value}km/h`;
      default:
        return `${value}`;
    }
  }, []);

  useEffect(() => {
    searchAll(); // searchAll per caricare i dati

    const intervalId = setInterval(() => {
      searchAll();
      console.log('Refreshing data...'); // Log per indicare che i dati vengono aggiornati
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId); // Pulisce l'intervallo quando il componente viene smontato
  }, [searchAll]);

  // TODO: Da implementare quando le predizioni saranno pronte
  /* const checkisDangerous = useCallback( // Controlla se il valore di un dato  è fuori dai limiti stabiliti
    // (minimo e massimo definiti nella configurazione della coltura).
    // indicando una condizione "pericolosa" o anomala.
    (key: string, value: number) => {
      const config = coltureData?.config as unknown as Record<string, number>;
      const min = config[`${key}_min`];
      const max = config[`${key}_max`];

      return value < min || value > max;
    },
    [coltureData?.config]
  ); */

  return (
    <>
      {isLoading && (
        <div className="flex items-center justify-center h-dvh">
          <LoaderCircle className="h-10 w-10 animate-spin" />
        </div>
      )}
      {!isLoading && landData && (
        <>
          <h1 className="text-xl font-semibold capitalize pb-5">
            {landData.name}
          </h1>
          <section>
            <ul className="grid grid-cols-4 gap-4">
              {landData.signals.map((signal, idx) => (
                <li key={idx}>
                  <CardInfo
                    /* className={
                      checkisDangerous(key, value as number)
                        ? 'text-red-500' // Se il valore è fuori dai limiti, il testo è rosso
                        : ''
                    } */
                    title={signal.name}
                    data={signal.value}
                    info={signal.lastConnection}
                    icon={getIcon(signal.name)}
                  />
                </li>
              ))}
            </ul>
          </section>
          {/*  <section className="mt-5">
            <div className="flex gap-2">
              <div
                className={`flex h-2 w-2 translate-y-1 rounded-full ${predictionColor}`}
              />
              <p className="leading-none">{coltureData.predizione}</p>
            </div>
            {coltureData.notifiche && coltureData.notifiche.length > 0 && (
              <section className="mt-5">
                <p className="text-lg font-medium">Alert</p>
                <div className="flex flex-col gap-2 mt-2">
                  {coltureData.notifiche.map((notifica, idx) => (
                    <p key={idx} className="text-md">
                      {notifica}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </section> */}
          {weatherForecastData && (
            <section className="mt-5">
              <p className="text-lg font-medium">Previsioni Meteo</p>
              <div className="flex items-center mt-2">
                <MapPin className="h-4 w-4" />
                <p className="ml-3 text-lg font-bold">
                  {weatherForecastData.city.name}
                </p>
              </div>
              {weatherForecastData.list.map((forecast, idx) => (
                <Accordion key={idx} type="single" collapsible>
                  <AccordionItem value="item-1">
                    <AccordionTrigger>
                      <p className="text-lg font-medium">{forecast.date}</p>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-lg font-bold capitalize">
                        {forecast.weatherDescription}
                      </p>
                      <ul className="flex justify-between flex-wrap gap-4 mt-5">
                        {Object.entries(forecast).map(([key, value]) => (
                          <Fragment key={key}>
                            {value
                              && key !== 'date'
                              && key !== 'weatherDescription' && (
                              <li key={key} className="flex-1">
                                <CardInfo
                                  title={key.toUpperCase()}
                                  data={getData(key, value as number)}
                                  icon={getIcon(key)}
                                />
                              </li>
                            )}
                          </Fragment>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
};
