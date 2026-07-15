import { StyleSheet } from 'react-native';

const formModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  formCard: {
    backgroundColor: '#fafafa',
    borderRadius: 14,
    padding: 12,
  },
  input: {
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  controls: {
    flexDirection: 'row',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  saveBtn: {
    borderRadius: 10,
    marginLeft: 8,
  },
});

export default formModalStyles;
