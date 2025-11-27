export const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp.seconds * 1000 + timestamp.nanos / 1000000);
    return date.toLocaleString();
};

export const getLastUpdate = (history) => {
    if (history.length > 0) {
        return formatTimestamp(history[history.length - 1].Timestamp);
    }
    return null;
};

export const getFirstUpdate = (history) => {
    if (history.length > 0) {
        return formatTimestamp(history[0].Timestamp);
    }
    return null;
};
