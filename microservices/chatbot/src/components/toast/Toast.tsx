import { useEffect, useMemo, useState } from 'react';

import { ToastProps, ToastTypes } from './types';

import ErrorIcon from '@assets/toast/error.svg';
import InfoIcon from '@assets/toast/info.svg';
import SuccessIcon from '@assets/toast/success.svg';
import WarningIcon from '@assets/toast/warning.svg';

export const Toast = ({ type, message }: ToastProps): JSX.Element => {
  const [isActive, setIsActive] = useState(false);

  const alertClass = useMemo(() => {
    switch (type) {
      case ToastTypes.SUCCESS:
        return 'alert-success';
      case ToastTypes.ERROR:
        return 'alert-error';
      case ToastTypes.INFO:
        return 'alert-info';
      case ToastTypes.WARNING:
        return 'alert-warning';
    }
  }, [type]);

  const icon = useMemo(() => { //useMemo si usa per calcolare il valore solo quando type cambia
    switch (type) {
      case ToastTypes.SUCCESS: //Restituisce l'icona corretta in base al tipo
        return SuccessIcon;
      case ToastTypes.ERROR: 
        return ErrorIcon;
      case ToastTypes.INFO:
        return InfoIcon;
      case ToastTypes.WARNING:
        return WarningIcon;
    }
  }, [type]);

  useEffect(() => {
    setIsActive(true);
    const timer = setTimeout(() => setIsActive(false), 3000); //Chiude il toast dopo 3 secondi
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="alert"
      className={`alert ${alertClass} fixed top-8 right-2 z-50 w-auto flex gap-2 transition-all ease-in-out duration-500 transform ${isActive ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <img className="w-5" src={icon} alt="icon" />
      <span>{message}</span>
    </div>
  );
};
