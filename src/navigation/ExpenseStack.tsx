import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExpenseStackParamList } from './types';
import { ExpenseListScreen } from '@features/expenses/screens/ExpenseListScreen';

const Stack = createNativeStackNavigator<ExpenseStackParamList>();

export const ExpenseStack: React.FC = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
    </Stack.Navigator>
);
