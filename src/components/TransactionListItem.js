import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../components/Theme';
import {
  getTransactionType,
  getAmountColor,
  getAmountPrefix,
  getTypeIcon,
} from '../utils/transactionUtils';

export default function TransactionListItem({
  item,
  category,
  source,
  isLast,
  showDate,
  hideAmount,
  onPress,
}) {
  const type = getTransactionType(item);
  const amountColor = getAmountColor(type);
  const prefix = getAmountPrefix(type);
  const transactionDate = new Date(item.date);
  const timeText = transactionDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const dateText = transactionDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const accentColor =
    type === 'income'
      ? '#20A56A'
      : type === 'transfer'
      ? '#718096'
      : '#E35D6A';
  const iconColor = category?.color || accentColor;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        marginBottom: isLast ? 12 : 8,
      }}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 17,
          overflow: 'hidden',

          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 3,
          },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* LEFT ACCENT */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: accentColor,
          }}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 82,
            paddingLeft: 15,
            paddingRight: 12,
            paddingVertical: 12,
          }}
        >
          {/* ================================================= */}
          {/* CATEGORY ICON */}
          {/* ================================================= */}

          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: iconColor,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,

              shadowColor: iconColor,
              shadowOffset: {
                width: 0,
                height: 3,
              },
              shadowOpacity: 0.22,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <MaterialCommunityIcons
              name={category?.icon || getTypeIcon(type)}
              size={23}
              color="#FFFFFF"
            />
          </View>

          {/* ================================================= */}
          {/* MIDDLE DETAILS */}
          {/* ================================================= */}

          <View
            style={{
              flex: 1,
              minWidth: 0,
              justifyContent: 'center',
              paddingRight: 8,
            }}
          >
            {/* TRANSACTION NOTES */}

            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={{
                fontSize: 15,
                lineHeight: 19,
                fontWeight: '800',
                color: Colors.text,
                letterSpacing: -0.15,
              }}
            >
              {item.notes || 'No notes'}
            </Text>

            {/* CATEGORY + SOURCE */}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 6,
                minWidth: 0,
              }}
            >
              {/* CATEGORY */}

              <View
                style={{
                  flexShrink: 1,
                  maxWidth: '58%',
                  backgroundColor: iconColor + '12',
                  borderRadius: 6,
                  paddingHorizontal: 7,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: iconColor + '18',
                }}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    color: iconColor,
                    fontSize: 11,
                    lineHeight: 13,
                    fontWeight: '800',
                  }}
                >
                  {category?.name || 'Uncategorized'}
                </Text>
              </View>

              {/* DOT */}

              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: '#C7CBD1',
                  marginHorizontal: 6,
                  flexShrink: 0,
                }}
              />

              {/* SOURCE */}

              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: '#9299A3',
                  fontSize: 11,
                  lineHeight: 14,
                  fontWeight: '600',
                }}
              >
                {source?.name || 'No source'}
              </Text>
            </View>
          </View>

          {/* ================================================= */}
          {/* RIGHT AMOUNT COLUMN */}
          {/* ================================================= */}

          <View
            style={{
              width: 90,
              flexShrink: 0,
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            {/* AMOUNT */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{
                width: '100%',
                textAlign: 'right',
                fontSize: 15,
                fontWeight: '900',
                color: item.is_counted === 0 ? '#9CA3AF' : amountColor, // grey out if not counted
                letterSpacing: -0.35,
                textDecorationLine:
                  item.is_counted === 0 ? 'line-through' : 'none', // strikethrough
              }}
            >
              {hideAmount
                ? '••••••'
                : `${prefix}₹${Number(item.amount || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </Text>

            {/* NOT COUNTED BADGE */}
            {item.is_counted === 0 && (
              <View
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  marginTop: 3,
                  alignSelf: 'flex-end',
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    color: '#9CA3AF',
                    fontWeight: '700',
                    letterSpacing: 0.3,
                  }}
                >
                  {item.type === 'expense' ? 'NOT SPEND' : 'NOT INCOME'}
                </Text>
              </View>
            )}

            {/* OPTIONAL DATE */}
            {showDate && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  marginTop: 5,
                }}
              >
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={11}
                  color="#A3A9B2"
                />
                <Text
                  style={{
                    color: '#9299A3',
                    fontSize: 10,
                    fontWeight: '700',
                    marginLeft: 3,
                  }}
                >
                  {dateText}
                </Text>
              </View>
            )}

            {/* TIME / TRANSFER */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: 6,
                minHeight: 15,
              }}
            >
              {type === 'transfer' ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F1F3F5',
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <MaterialCommunityIcons
                    name="swap-horizontal"
                    size={11}
                    color="#718096"
                  />

                  <Text
                    style={{
                      fontSize: 8,
                      fontWeight: '900',
                      color: '#718096',
                      marginLeft: 3,
                      letterSpacing: 0.25,
                    }}
                  >
                    TRANSFER
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={11}
                    color="#A3A9B2"
                  />

                  <Text
                    style={{
                      color: '#A3A9B2',
                      fontSize: 10,
                      fontWeight: '600',
                      marginLeft: 3,
                    }}
                  >
                    {timeText}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
