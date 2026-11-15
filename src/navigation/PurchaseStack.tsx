import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PurchaseStackParamList } from "./types";
import { PurchaseInvoicesList } from "src/application/features/purchase/screens/PurchaseInvoicesList";
import { PurchaseInvoiceForm } from "src/application/features/purchase/screens/PurchaseInvoiceForm";
import { PurchaseInvoiceDetail } from "src/application/features/purchase/screens/PurchaseInvoiceDetail";
import { PurchaseInvoiceEdit } from "src/application/features/purchase/screens/PurchaseInvoiceEdit";

const Stack = createNativeStackNavigator<PurchaseStackParamList>();

export const PurchaseStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen
      name="PurchaseInvoicesList"
      component={PurchaseInvoicesList}
    />
    <Stack.Screen name="PurchaseInvoiceForm" component={PurchaseInvoiceForm} />
    <Stack.Screen
      name="PurchaseInvoiceDetail"
      component={PurchaseInvoiceDetail}
    />
    <Stack.Screen name="PurchaseInvoiceEdit" component={PurchaseInvoiceEdit} />
  </Stack.Navigator>
);
