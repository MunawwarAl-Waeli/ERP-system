import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CustomerStackParamList } from "./types";
import { CustomerListScreen } from "src/application/features/customers/screens/CustomerListScreen";
import { CustomerDetailScreen } from "src/application/features/customers/screens/CustomerDetailScreen";
import { CustomerFormScreen } from "src/application/features/customers/screens/CustomerFormScreen";
import { CustomerLedgerScreen } from "src/application/features/customers/screens/CustomerLedgerScreen";

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export const CustomerStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CustomerList" component={CustomerListScreen} />
    <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    <Stack.Screen name="CustomerForm" component={CustomerFormScreen} />
    <Stack.Screen name="CustomerLedger" component={CustomerLedgerScreen} />
  </Stack.Navigator>
);
