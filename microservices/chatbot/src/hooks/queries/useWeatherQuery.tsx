import { useCallback } from 'react';

import { useErrorHandler } from './useErrorHandler';

import { formatDate } from '@/utils';
import { WeatherForecastEntity, WeatherForecastModel } from '@models/index';

export const useWeatherQuery = (): {
  getWeatherForecast: ({
    lat,
    long,
    cnt,
  }: {
    lat: number;
    long: number;
    cnt ?: number;
  }) => Promise<{ data?: WeatherForecastModel; error?: Error }>; // Ritorna una promessa con i dati del meteo e un eventuale errore
} => {
  const apiKey = 'ee38d169f45a80611efcd0ee9f5ab658'; // Open weather API key

  const { handleError } = useErrorHandler();

  const getWeatherForecast = useCallback(
    async ({ lat, long, cnt = 40 }: { lat: number; long: number, cnt?: number }) => {
      const forecast = []; // Crea un array vuoto per i dati del meteo

      try {
        const response = await fetch( // Chiama l'endpoint forecast con latitudine e longitudine
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${long}&units=metric&cnt=${cnt}&appid=${apiKey}&lang=it`,
          { method: 'GET' }
        );

        if (!response.ok) {
          switch (response.status) {
            case 401:
              throw new Error('Unauthorized');
            case 403:
              throw new Error('Forbidden');
            case 404:
              throw new Error('Not found');
            default:
            {
              const { message } = await response.json();
              throw new Error(message);
            }
          }
        }

        const responseData: WeatherForecastEntity = await response.json();

        for (const idx of responseData.list.keys()) {
          if (cnt === 40) {
            if (idx % 2 === 0 && idx <= 6) {
              forecast.push(responseData.list[idx]);
            }// Se l'indice è pari e minore o uguale a 6, aggiungi i dati al forecast relativi a quell'indice
          } else {
            if (idx % 2 === 0) {
              forecast.push(responseData.list[idx]);
            }
          } 
        }

        const data: WeatherForecastModel = {
          city: responseData.city,
          list: forecast.map(item => ({
            date: formatDate(item.dt),
            temperatura: item.main.temp,
            umidità: item.main.humidity,
            vento: item.wind.speed,
            weatherDescription: item.weather[0].description,
          })), // Crea un oggetto data con i dati del meteo
        };

        return { data }; // Ritorna i dati
      } catch (err) {
        const error = err as Error;
        handleError(error);
        return { error };
      }
    },
    [handleError]
  );

  return {
    getWeatherForecast,
  };
};
