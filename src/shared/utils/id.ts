import {
    incrementBillSequence,
    getLastBillDate,
    setLastBillDate,
    resetBillSequence,
} from '@core/storage/mmkv';
import { formatDateForBill } from './date';

export const generateNumber = (prefix: string): string => {
    const today = formatDateForBill();
    const lastDate = getLastBillDate(prefix);

    if (lastDate !== today) {
        resetBillSequence(prefix);
        setLastBillDate(prefix, today);
    }

    const seq = incrementBillSequence(prefix);
    const seqStr = seq.toString().padStart(4, '0');

    return `${prefix}-${today}-${seqStr}`;
};
