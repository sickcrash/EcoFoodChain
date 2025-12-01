// Formatta la data in timestamp in formato gg/mm/aaaa hh:mm nel fuso orario locale
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000); // Converti il timestamp in millisecondi
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // I mesi sono indicizzati da 0
  const year = date.getFullYear();
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} - ${hour}:${minute}`;
};

export const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes > 1 ? 'minuti' : 'minuto'} fa`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours > 1 ? 'ore' : 'ora'} fa`;
  } else if (diffDays < 30) {
    return `${diffDays} ${diffDays > 1 ? 'giorni' : 'giorno'} fa`;
  } else {
    return `${diffMonths} ${diffMonths > 1 ? 'mesi' : 'mese'} fa`;
  }
};
