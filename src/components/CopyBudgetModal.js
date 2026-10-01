import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategoryBudgetSummary } from '../services/categoryBudgets';

export default function CopyBudgetModal({ visible, onClose, onCopy }) {
  const [selectedDate, setSelectedDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Generate last 12 months
  const months = [];
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }

  useEffect(() => {
    if (visible) {
      loadBudgets(selectedDate);
    }
  }, [visible, selectedDate]);

  const loadBudgets = async (date) => {
    setLoading(true);
    try {
      const summary = await getCategoryBudgetSummary(date.getMonth() + 1, date.getFullYear());
      setBudgets(summary.filter(b => b.budget > 0));
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#172033', marginBottom: 16 }}>Copy Category Budgets</Text>
          
          <Text style={{ fontSize: 13, color: '#667085', fontWeight: '600', marginBottom: 12 }}>Select a month to copy from:</Text>
          <View style={{ marginBottom: 20 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
              {months.map((m, idx) => {
                const isSelected = m.getTime() === selectedDate.getTime();
                return (
                  <TouchableOpacity 
                    key={idx} 
                    onPress={() => setSelectedDate(m)}
                    style={{
                      paddingHorizontal: 16, 
                      paddingVertical: 10, 
                      borderRadius: 14, 
                      backgroundColor: isSelected ? '#E8F7EF' : '#F3F4F6',
                      borderColor: isSelected ? '#36B37E' : '#E5E7EB',
                      borderWidth: 1,
                      marginRight: 10,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                    <Text style={{ color: isSelected ? '#1B5E20' : '#4B5563', fontWeight: '700', fontSize: 14 }}>
                      {m.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '800', color: '#7B8794', marginBottom: 12, letterSpacing: 0.5 }}>PREVIEW BUDGETS</Text>
          {loading ? (
            <Text style={{ marginVertical: 30, textAlign: 'center', color: '#9AA5B1', fontWeight: '600' }}>Loading budgets...</Text>
          ) : budgets.length === 0 ? (
            <View style={{ marginVertical: 20, alignItems: 'center' }}>
              <MaterialCommunityIcons name="folder-open-outline" size={40} color="#CBD5E1" style={{ marginBottom: 10 }} />
              <Text style={{ textAlign: 'center', color: '#9AA5B1', fontWeight: '600' }}>No category budgets found for {selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.</Text>
            </View>
          ) : (
            <FlatList
              data={budgets}
              keyExtractor={item => String(item.categoryId)}
              style={{ maxHeight: 300, backgroundColor: '#F9FAFB', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#F1F5F9' }}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (item.color || '#ccc') + '20', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                    <MaterialCommunityIcons name={item.icon || 'tag'} size={20} color={item.color || '#ccc'} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#334155' }}>{item.categoryName}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#1B5E20' }}>₹{item.budget.toLocaleString('en-IN')}</Text>
                </View>
              )}
            />
          )}

          <View style={{ flexDirection: 'row', marginTop: 24 }}>
            <Button 
              mode="outlined" 
              onPress={onClose} 
              style={{ flex: 1, marginRight: 12, borderRadius: 12, borderColor: '#DCE2E7' }}
              contentStyle={{ paddingVertical: 6 }}
              labelStyle={{ color: '#64748B', fontWeight: '700' }}>
              Cancel
            </Button>
            <Button 
              mode="contained" 
              disabled={budgets.length === 0}
              onPress={() => onCopy(selectedDate.getMonth() + 1, selectedDate.getFullYear())} 
              style={{ flex: 1, borderRadius: 12, backgroundColor: budgets.length === 0 ? '#CBD5E1' : '#36B37E' }}
              contentStyle={{ paddingVertical: 6 }}
              labelStyle={{ fontWeight: '800' }}>
              Confirm & Copy
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
