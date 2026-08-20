import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BillingStackParamList } from './types';
import { BillingScreen } from '@features/billing/screens/BillingScreen';
import { SalesInvoiceDetailScreen } from '@features/billing/screens/BillPreviewScreen';
import { SalesInvoiceHistoryScreen } from '@features/billing/screens/BillHistoryScreen';

const Stack = createNativeStackNavigator<BillingStackParamList>();

export const BillingStack: React.FC = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BillingHome" component={BillingScreen} />
        <Stack.Screen name="SalesInvoiceDetail" component={SalesInvoiceDetailScreen} />
        <Stack.Screen name="SalesInvoiceList" component={SalesInvoiceHistoryScreen} />
    </Stack.Navigator>
);
