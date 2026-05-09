export const SERVICE_FEE_RATE = 0.10;
export const SERVICE_FEE_FLAT = 0.99;

const roundCurrency = (value: number) => Number(value.toFixed(2));

export const calculateServiceFee = (subtotalAfterPromo: number, quantity: number) =>
  subtotalAfterPromo <= 0 ? 0 : roundCurrency(subtotalAfterPromo * SERVICE_FEE_RATE + Math.max(1, quantity || 1) * SERVICE_FEE_FLAT);

interface ResolveOrderPricingInput {
  unitPrice: number | null | undefined;
  quantity: number | null | undefined;
  discount?: number | null;
  total?: number | null;
}

export const resolveOrderPricing = ({ unitPrice, quantity, discount = 0, total }: ResolveOrderPricingInput) => {
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  const storedUnitPrice = Math.max(0, Number(unitPrice) || 0);
  const promoDiscount = Math.max(0, Number(discount) || 0);

  // unit_price always stores the ORIGINAL ticket price per unit
  const ticketPrice = roundCurrency(storedUnitPrice * safeQuantity);
  const subtotalAfterPromo = roundCurrency(Math.max(0, ticketPrice - promoDiscount));
  const serviceFee = calculateServiceFee(subtotalAfterPromo, safeQuantity);
  const totalPaid = roundCurrency(subtotalAfterPromo + serviceFee);

  return {
    ticketPrice,
    promoDiscount,
    subtotalAfterPromo,
    serviceFee,
    totalPaid,
    unitPriceBeforePromo: roundCurrency(ticketPrice / safeQuantity),
  };
};