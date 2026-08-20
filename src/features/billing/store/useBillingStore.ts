import { create } from "zustand";
import { CartItem } from "@core/types";

interface BillingState {
  cartItems: CartItem[];
  selectedCustomerId: string | null;
  paymentType: "cash" | "credit" | "partial";
  discountTotal: number;
  notes: string;

  // Computed
  subtotal: number;
  grandTotal: number;
  serviceFee: number;
  setServiceFee: (fee: number) => void;

  // Actions
  addToCart: (item: Omit<CartItem, "total" | "costAtSale">) => void;
  updateQuantity: (
    productId: string,
    productUnitId: string,
    quantity: number,
  ) => void;
  updateDiscount: (
    productId: string,
    productUnitId: string,
    discount: number,
  ) => void;
  removeFromCart: (productId: string, productUnitId: string) => void;
  setCustomer: (customerId: string | null) => void;
  setPaymentType: (type: "cash" | "credit" | "partial") => void;
  setBillDiscount: (discount: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
}

// دوال مساعدة للحسابات
const calculateItemTotal = (item: CartItem): number =>
  item.quantity * item.unitPrice - item.discount;

const recalculateTotals = (
  cartItems: CartItem[],
  discountTotal: number,
  serviceFee: number,
) => {
  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = Math.max(0, subtotal - discountTotal + serviceFee);
  return { subtotal, grandTotal };
};

export const useBillingStore = create<BillingState>((set, get) => ({
  // ========== الحالة الأولية ==========
  cartItems: [],
  selectedCustomerId: null,
  paymentType: "cash",
  discountTotal: 0,
  serviceFee: 0, // 👈 إضافة القيمة الأولية
  notes: "",
  subtotal: 0,
  grandTotal: 0,

  // ========== الإجراءات ==========

  addToCart: (item) => {
    const state = get();
    const existingIndex = state.cartItems.findIndex(
      (ci) =>
        ci.productId === item.productId &&
        ci.productUnitId === item.productUnitId,
    );

    let newItems: CartItem[];

    if (existingIndex >= 0) {
      newItems = state.cartItems.map((ci, index) => {
        if (index === existingIndex) {
          const updatedItem = {
            ...ci,
            quantity: ci.quantity + item.quantity,
          };
          updatedItem.total = calculateItemTotal(updatedItem);
          return updatedItem;
        }
        return ci;
      });
    } else {
      const newItem: CartItem = {
        ...item,
        total: item.quantity * item.unitPrice - (item.discount || 0),
        costAtSale: 0,
      };
      newItems = [...state.cartItems, newItem];
    }

    const totals = recalculateTotals(
      newItems,
      state.discountTotal,
      state.serviceFee,
    ); // 👈 تمرير serviceFee
    set({ cartItems: newItems, ...totals });
  },

  updateQuantity: (productId, productUnitId, quantity) => {
    const state = get();
    const newItems = state.cartItems.map((ci) => {
      if (ci.productId === productId && ci.productUnitId === productUnitId) {
        const updatedItem = { ...ci, quantity };
        updatedItem.total = calculateItemTotal(updatedItem);
        return updatedItem;
      }
      return ci;
    });

    const totals = recalculateTotals(
      newItems,
      state.discountTotal,
      state.serviceFee,
    ); // 👈 تمرير serviceFee
    set({ cartItems: newItems, ...totals });
  },

  updateDiscount: (productId, productUnitId, discount) => {
    const state = get();
    const newItems = state.cartItems.map((ci) => {
      if (ci.productId === productId && ci.productUnitId === productUnitId) {
        const updatedItem = { ...ci, discount };
        updatedItem.total = calculateItemTotal(updatedItem);
        return updatedItem;
      }
      return ci;
    });

    const totals = recalculateTotals(
      newItems,
      state.discountTotal,
      state.serviceFee,
    ); // 👈 تمرير serviceFee
    set({ cartItems: newItems, ...totals });
  },

  removeFromCart: (productId, productUnitId) => {
    const state = get();
    const newItems = state.cartItems.filter(
      (ci) =>
        !(ci.productId === productId && ci.productUnitId === productUnitId),
    );
    const totals = recalculateTotals(
      newItems,
      state.discountTotal,
      state.serviceFee,
    ); // 👈 تمرير serviceFee
    set({ cartItems: newItems, ...totals });
  },

  setCustomer: (customerId) => set({ selectedCustomerId: customerId }),

  setPaymentType: (type) => set({ paymentType: type }),

  setBillDiscount: (discount) => {
    const state = get();
    const totals = recalculateTotals(
      state.cartItems,
      discount,
      state.serviceFee,
    ); // 👈 تمرير serviceFee
    set({ discountTotal: discount, ...totals });
  },

  // 👈 تنفيذ دالة أجور الخدمات
  setServiceFee: (fee) => {
    const state = get();
    const totals = recalculateTotals(state.cartItems, state.discountTotal, fee);
    set({ serviceFee: fee, ...totals });
  },

  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      cartItems: [],
      selectedCustomerId: null,
      paymentType: "cash",
      discountTotal: 0,
      serviceFee: 0,
      notes: "",
      subtotal: 0,
      grandTotal: 0,
    }),
}));
