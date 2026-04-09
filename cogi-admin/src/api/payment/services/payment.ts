import { factories } from '@strapi/strapi';

const PAYMENT_UID = 'api::payment.payment';
const PAYMENT_ALLOCATION_UID = 'api::payment-allocation.payment-allocation';
const FEE_ITEM_UID = 'api::fee-item.fee-item';

function toDecimal(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toTime(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  const time = date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
  return time;
}

async function getPaymentAllocationSum(paymentId: number) {
  const allocations = await strapi.db.query(PAYMENT_ALLOCATION_UID).findMany({
    where: { payment: { id: { $eq: paymentId } } },
    select: ['amount'],
  });

  return (allocations || []).reduce((sum: number, item: any) => sum + toDecimal(item?.amount, 0), 0);
}

export default factories.createCoreService(PAYMENT_UID, () => ({
  async autoAllocatePayment(paymentId: number) {
    const numericPaymentId = Number(paymentId);
    if (!Number.isInteger(numericPaymentId) || numericPaymentId <= 0) {
      throw new Error('paymentId is invalid');
    }

    const payment = await strapi.db.query(PAYMENT_UID).findOne({
      where: { id: numericPaymentId },
      populate: {
        learner: { select: ['id'], populate: { tenant: { select: ['id'] } } },
        tenant: { select: ['id'] },
      },
    });

    if (!payment?.id) throw new Error('Payment not found');
    if (!payment?.learner?.id) throw new Error('Payment learner is invalid');

    const allocatedSum = await getPaymentAllocationSum(payment.id);
    let remainingAmount = roundMoney(Math.max(0, toDecimal(payment.amount, 0) - allocatedSum));

    if (remainingAmount <= 0) {
      return {
        paymentId: payment.id,
        allocatedAmount: allocatedSum,
        remainingAmount: 0,
        createdAllocations: [],
      };
    }

    const feeItems = await strapi.db.query(FEE_ITEM_UID).findMany({
      where: {
        learner: { id: { $eq: payment.learner.id } },
        tenant: payment.tenant?.id,
        status: { $in: ['unpaid', 'partial'] },
      },
      populate: {
        feeSheetClass: {
          populate: {
            feeSheet: { select: ['id', 'fromDate'] },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const sortedItems = (feeItems || []).sort((left: any, right: any) => {
      const leftTime = toTime(left?.feeSheetClass?.feeSheet?.fromDate || left?.createdAt);
      const rightTime = toTime(right?.feeSheetClass?.feeSheet?.fromDate || right?.createdAt);
      if (leftTime !== rightTime) return leftTime - rightTime;
      return Number(left?.id || 0) - Number(right?.id || 0);
    });

    const createdAllocations = [];
    for (const feeItem of sortedItems) {
      if (remainingAmount <= 0) break;

      const itemAmount = toDecimal(feeItem?.amount, 0);
      const itemPaidAmount = toDecimal(feeItem?.paidAmount, 0);
      const itemRemaining = roundMoney(Math.max(0, itemAmount - itemPaidAmount));
      if (itemRemaining <= 0) continue;

      const allocationAmount = roundMoney(Math.min(itemRemaining, remainingAmount));
      if (allocationAmount <= 0) continue;

      const allocation = await strapi.db.query(PAYMENT_ALLOCATION_UID).create({
        data: {
          payment: payment.id,
          feeItem: feeItem.id,
          amount: allocationAmount,
          tenant: payment.tenant?.id,
        },
      });

      createdAllocations.push({
        allocationId: allocation.id,
        feeItemId: feeItem.id,
        amount: allocationAmount,
      });
      remainingAmount = roundMoney(Math.max(0, remainingAmount - allocationAmount));
    }

    return {
      paymentId: payment.id,
      allocatedAmount: roundMoney(toDecimal(payment.amount, 0) - remainingAmount),
      remainingAmount,
      createdAllocations,
    };
  },
}));