import moment from 'moment';

export const formatTime = (timestamp) => {
    return moment(timestamp).fromNow();
};

export const formatFullTime = (timestamp) => {
    return moment(timestamp).format('MMM DD, YYYY HH:mm');
};