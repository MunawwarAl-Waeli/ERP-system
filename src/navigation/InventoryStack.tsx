import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { InventoryStackParamList } from "./types";
import { ProductListScreen } from "src/application/features/inventory/screens/ProductListScreen";
import { ProductDetailScreen } from "src/application/features/inventory/screens/ProductDetailScreen";
import { ProductFormScreen } from "src/application/features/inventory/screens/ProductFormScreen";
import { StockAdjustmentScreen } from "src/application/features/inventory/screens/StockAdjustmentScreen";
import { InventoryScreen } from "src/application/features/inventory/screens/InventoryScreen";

const Stack = createNativeStackNavigator<InventoryStackParamList>();

export const InventoryStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProductList" component={ProductListScreen} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    <Stack.Screen name="ProductForm" component={ProductFormScreen} />
    <Stack.Screen name="StockAdjustment" component={StockAdjustmentScreen} />
    <Stack.Screen name="InventoryOverview" component={InventoryScreen} />
  </Stack.Navigator>
);
