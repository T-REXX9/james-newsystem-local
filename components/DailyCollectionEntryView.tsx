import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Calendar, Search } from 'lucide-react';
import {
  dailyCollectionService,
  DailyCollectionApproverLog,
  DailyCollectionHeader,
  DailyCollectionItem,
  CollectionCustomer,
  CollectionUnpaidRow,
} from '../services/dailyCollectionService';
import { getLocalAuthSession } from '../services/localAuthService';
import DeleteCollectionReportModal from './DeleteCollectionReportModal';

const COLLECTION_PAGE_NO = '21';

const hasDeletePermission = (): boolean => {
  const session = getLocalAuthSession();
  const webPerms = session?.context?.permissions?.web;
  if (!Array.isArray(webPerms)) return false;
  const perm = webPerms.find(
    (p) => String(p.lpageno) === COLLECTION_PAGE_NO,
  );
  return String(perm?.ldelete_action) === '1';
};

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const toDateInput = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toDisplayDate = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getStatusChipColor = (
  status?: string,
): 'default' | 'success' | 'error' | 'info' | 'warning' => {
  switch ((status || '').toLowerCase()) {
    case 'approved':
    case 'posted':
    case 'received':
    case 'deposited':
      return 'success';
    case 'rejected':
    case 'cancelled':
    case 'disapproved':
      return 'error';
    case 'submitted':
      return 'info';
    default:
      return 'warning';
  }
};

const DailyCollectionEntryView: React.FC = () => {
  const [headers, setHeaders] = useState<DailyCollectionHeader[]>([]);
  const [selectedRefno, setSelectedRefno] = useState<string>('');
  const [selectedHeader, setSelectedHeader] = useState<DailyCollectionHeader | null>(null);
  const [items, setItems] = useState<DailyCollectionItem[]>([]);
  const [approverLogs, setApproverLogs] = useState<DailyCollectionApproverLog[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const [customers, setCustomers] = useState<CollectionCustomer[]>([]);
  const [unpaidRows, setUnpaidRows] = useState<CollectionUnpaidRow[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Record<string, boolean>>({});

  const [search, setSearch] = useState('');
  const [statusFilter] = useState('All');
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [workingAction, setWorkingAction] = useState('');
  const [showDeleteReportModal, setShowDeleteReportModal] = useState(false);
  const [error, setError] = useState('');
  const [showApproverLogsModal, setShowApproverLogsModal] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    type: 'Cash',
    bank: '',
    checkNo: '',
    checkDate: toDateInput(new Date().toISOString()),
    amount: '',
    status: 'Received',
    collectDate: toDateInput(new Date().toISOString()),
    remarks: '',
  });

  const selectedAmount = useMemo(() => {
    return unpaidRows
      .filter((row) => selectedTransactions[`${row.transactionType}:${row.lrefno}`])
      .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  }, [unpaidRows, selectedTransactions]);

  const totalCheck = useMemo(() => items.filter((i) => i.ltype === 'Check').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const totalTT = useMemo(() => items.filter((i) => i.ltype === 'TT').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const totalCash = useMemo(() => items.filter((i) => i.ltype === 'Cash').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const grandTotal = useMemo(() => items.reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);

  const postableItems = useMemo(
    () => items.filter((item) => item.lpost !== 1 && item.lcollection_status !== 'Posted'),
    [items],
  );
  const allSelectableChecked = postableItems.length > 0 && selectedItemIds.length === postableItems.length;

  const fetchList = async () => {
    setListLoading(true);
    setError('');
    try {
      let dateFrom = '';
      let dateTo = '';
      if (filterMonth !== 'All') {
        const year = parseInt(filterYear, 10);
        const month = parseInt(filterMonth, 10);
        if (!Number.isNaN(year) && year >= 2000 && year <= 2099) {
          dateFrom = `${year}-${filterMonth}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          dateTo = `${year}-${filterMonth}-${String(lastDay).padStart(2, '0')}`;
        }
      }
      const rows = await dailyCollectionService.listCollections({
        search,
        status: statusFilter,
        dateFrom,
        dateTo,
      });
      setHeaders(rows);
      if (!selectedRefno && rows[0]?.lrefno) {
        setSelectedRefno(rows[0].lrefno);
      } else if (selectedRefno && !rows.some((row) => row.lrefno === selectedRefno)) {
        setSelectedRefno(rows[0]?.lrefno || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load collections');
    } finally {
      setListLoading(false);
    }
  };

  const fetchDetail = async (refno: string) => {
    if (!refno) return;
    setDetailLoading(true);
    setError('');
    setSelectedTransactions({});
    setSelectedItemIds([]);
    try {
      const [header, collectionItems, logs] = await Promise.all([
        dailyCollectionService.getCollection(refno),
        dailyCollectionService.getCollectionItems(refno),
        dailyCollectionService.getApproverLogs(refno),
      ]);
      setSelectedHeader(header);
      setItems(collectionItems);
      setApproverLogs(logs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load collection detail');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    dailyCollectionService.getCustomers('').then(setCustomers).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    fetchList();
  }, [statusFilter, filterMonth, filterYear]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchList();
    }, 400);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [search]);

  useEffect(() => {
    if (!selectedRefno) {
      setSelectedHeader(null);
      setItems([]);
      setApproverLogs([]);
      return;
    }
    fetchDetail(selectedRefno);
  }, [selectedRefno]);

  useEffect(() => {
    if (!form.customerId) {
      setUnpaidRows([]);
      return;
    }
    dailyCollectionService
      .getUnpaidTransactions(form.customerId)
      .then(setUnpaidRows)
      .catch(() => setUnpaidRows([]));
  }, [form.customerId]);

  useEffect(() => {
    if (selectedAmount > 0) {
      setForm((prev) => ({ ...prev, amount: selectedAmount.toFixed(2) }));
    }
  }, [selectedAmount]);

  const handleCreate = async () => {
    setWorkingAction('create');
    setError('');
    try {
      const created = await dailyCollectionService.createCollection();
      await fetchList();
      setSelectedRefno(created.lrefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to create DCR');
    } finally {
      setWorkingAction('');
    }
  };

  const handleAction = async (
    action: 'submitrecord' | 'approverecord' | 'disapproverecord' | 'cancelrecord' | 'postrecord' | 'posttoledger',
  ) => {
    if (!selectedRefno) return;
    let remarks = '';
    if (action === 'disapproverecord') {
      remarks = window.prompt('Reason for disapproval', '') || '';
    }
    setWorkingAction(action);
    setError('');
    try {
      await dailyCollectionService.runAction(selectedRefno, action, remarks);
      await Promise.all([fetchList(), fetchDetail(selectedRefno)]);
    } catch (err: any) {
      setError(err?.message || `Failed to run ${action}`);
    } finally {
      setWorkingAction('');
    }
  };

  const handleDeleteCollectionReport = async () => {
    if (!selectedRefno) return;
    setWorkingAction('delete-report');
    setError('');
    try {
      await dailyCollectionService.deleteCollection(selectedRefno);
      setSelectedRefno('');
      setSelectedHeader(null);
      setItems([]);
      setApproverLogs([]);
      await fetchList();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete collection report');
      throw err;
    } finally {
      setWorkingAction('');
    }
  };

  const handlePostSelectedItems = async () => {
    if (!selectedRefno || selectedItemIds.length === 0) return;
    setWorkingAction('post-items');
    setError('');
    try {
      await dailyCollectionService.postItems(selectedRefno, selectedItemIds);
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to post selected lines');
    } finally {
      setWorkingAction('');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedRefno || !window.confirm('Delete this payment line?')) return;
    setWorkingAction(`delete-${itemId}`);
    setError('');
    try {
      await dailyCollectionService.deleteItem(itemId);
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete payment line');
    } finally {
      setWorkingAction('');
    }
  };

  const handleDeleteSelectedItems = async () => {
    if (!selectedRefno || selectedItemIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedItemIds.length} selected payment line(s)?`)) return;
    setWorkingAction('delete-selected');
    setError('');
    try {
      for (const itemId of selectedItemIds) {
        await dailyCollectionService.deleteItem(itemId);
      }
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete selected lines');
    } finally {
      setWorkingAction('');
    }
  };

  const handleTypeChange = (newType: string) => {
    let autoStatus = 'Received';
    if (newType === 'Check') autoStatus = 'Pending';
    else if (newType === 'TT') autoStatus = 'Deposited';
    else if (newType === 'Cash') autoStatus = 'Received';
    setForm((prev) => ({ ...prev, type: newType, status: autoStatus }));
  };

  const handleSavePayment = async () => {
    if (!selectedRefno) return;
    if (!form.customerId) {
      setError('Customer is required');
      return;
    }
    const amount = Number(form.amount || 0);
    if (!(amount > 0)) {
      setError('Amount must be greater than 0');
      return;
    }
    if (!form.collectDate) {
      setError('Collection date is required');
      return;
    }

    const transactions = unpaidRows
      .filter((row) => selectedTransactions[`${row.transactionType}:${row.lrefno}`])
      .map((row) => ({
        transaction_type: row.transactionType,
        transaction_refno: row.lrefno,
        transaction_no: row.linvoice_no,
        transaction_amount: Number(row.totalAmount || 0),
      }));

    setSavingPayment(true);
    setError('');
    try {
      await dailyCollectionService.addPayment(selectedRefno, {
        customerId: form.customerId,
        type: form.type,
        bank: form.bank,
        checkNo: form.checkNo,
        checkDate: form.checkDate,
        amount,
        status: form.status,
        remarks: form.remarks,
        collectDate: form.collectDate,
        transactions,
      });
      setForm((prev) => ({
        ...prev,
        bank: '',
        checkNo: '',
        amount: '',
        remarks: '',
      }));
      setSelectedTransactions({});
      await Promise.all([fetchDetail(selectedRefno), fetchList()]);
    } catch (err: any) {
      setError(err?.message || 'Failed to add payment line');
    } finally {
      setSavingPayment(false);
    }
  };

  const canAddPayment = selectedHeader?.lstatus === 'Pending' || selectedHeader?.lstatus === 'Submitted' || selectedHeader?.lstatus === 'Posted';

  const renderStatusButtons = () => {
    const status = selectedHeader?.lstatus;
    const primary: React.ReactNode[] = [];
    const secondary: React.ReactNode[] = [];

    if (status === 'Pending') {
      primary.push(
        <Button
          key="submit"
          variant="contained"
          color="primary"
          size="small"
          sx={{ minWidth: 110 }}
          onClick={() => handleAction('submitrecord')}
          disabled={!!workingAction}
        >
          For Approval
        </Button>,
      );
    }
    if (status === 'Submitted') {
      primary.push(
        <Button
          key="approve"
          variant="contained"
          color="success"
          size="small"
          sx={{ minWidth: 110 }}
          onClick={() => handleAction('approverecord')}
          disabled={!!workingAction}
        >
          Approve
        </Button>,
        <Button
          key="disapprove"
          variant="contained"
          color="error"
          size="small"
          sx={{ minWidth: 110 }}
          onClick={() => handleAction('disapproverecord')}
          disabled={!!workingAction}
        >
          Disapprove
        </Button>,
      );
    }
    if (status === 'Approved') {
      primary.push(
        <Button
          key="post"
          variant="contained"
          color="secondary"
          size="small"
          sx={{ minWidth: 110 }}
          onClick={() => handleAction('postrecord')}
          disabled={!!workingAction}
        >
          Post
        </Button>,
      );
    }
    if (selectedRefno) {
      secondary.push(
        <Button key="print" variant="outlined" size="small" onClick={() => window.print()}>
          Print
        </Button>,
        <Button
          key="logs"
          variant="outlined"
          size="small"
          onClick={() => setShowApproverLogsModal(true)}
        >
          Approver Logs
        </Button>,
      );
      if (status === 'Pending' && hasDeletePermission()) {
        secondary.push(
          <Button
            key="delete-report"
            variant="contained"
            color="error"
            size="small"
            onClick={() => setShowDeleteReportModal(true)}
            disabled={!!workingAction}
          >
            Delete Collection Report
          </Button>,
        );
      }
    }

    return { primary, secondary };
  };

  const statusButtons = renderStatusButtons();

  return (
    <Box sx={{ height: '100%', bgcolor: '#f3f4f6', p: 2 }}>
      <Box
        sx={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
          gap: 2,
        }}
      >
        <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ p: 2 }}>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                color="primary"
                size="medium"
                fullWidth
                onClick={handleCreate}
                disabled={workingAction === 'create'}
              >
                Create New
              </Button>
              <Stack
                direction="row"
                spacing={1}
                sx={{ bgcolor: 'grey.50', p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}
              >
                <FormControl size="small" sx={{ minWidth: 88 }}>
                  <Select value={filterMonth} onChange={(e) => setFilterMonth(String(e.target.value))}>
                    <MenuItem value="All">All</MenuItem>
                    {MONTH_NAMES.map((name, idx) => {
                      const value = String(idx + 1).padStart(2, '0');
                      return (
                        <MenuItem key={value} value={value}>
                          {name.substring(0, 3)}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  inputProps={{ min: 2000, max: 2099 }}
                  sx={{ width: 88 }}
                />
              </Stack>
            </Stack>

            <TextField
              fullWidth
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search DCR no / refno"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Divider />

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '110px minmax(0, 1fr)',
                px: 2,
                py: 1.25,
                bgcolor: 'grey.200',
                borderBottom: 2,
                borderColor: 'primary.main',
              }}
            >
              <Typography variant="caption" fontWeight={700}>Date</Typography>
              <Typography variant="caption" fontWeight={700}>DCR No.</Typography>
            </Box>

            {listLoading && <Typography sx={{ p: 2 }} variant="body2" color="text.secondary">Loading collections...</Typography>}
            {!listLoading && headers.length === 0 && (
              <Typography sx={{ p: 2 }} variant="body2" color="text.secondary">
                No collection record found.
              </Typography>
            )}

            {headers.map((row) => {
              const active = selectedRefno === row.lrefno;
              return (
                <Box
                  key={row.lrefno}
                  onClick={() => setSelectedRefno(row.lrefno)}
                  sx={(theme) => ({
                    display: 'grid',
                    gridTemplateColumns: '110px minmax(0, 1fr)',
                    px: 2,
                    py: 1.5,
                    mx: 1,
                    my: 0.5,
                    borderRadius: 2,
                    border: 1,
                    borderColor: active ? 'primary.main' : 'divider',
                    borderLeft: 4,
                    borderLeftColor: active ? 'primary.main' : 'transparent',
                    boxShadow: active ? 2 : 0,
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                    cursor: 'pointer',
                    bgcolor: active ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
                    '&:hover': {
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : 'grey.50',
                      boxShadow: 2,
                      borderColor: 'primary.light',
                    },
                  })}
                >
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Calendar size={12} />
                    <Typography variant="body2" color="text.secondary">
                      {toDisplayDate(row.ldatetime) || '-'}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={700} color={active ? 'primary.main' : 'text.primary'}>
                    {row.lcolection_no || row.lrefno}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, borderTop: '4px solid', borderTopColor: 'primary.main' }}>
          {!selectedRefno && (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
              <Typography>Select or create a DCR record</Typography>
            </Box>
          )}

          {selectedRefno && (
            <>
              <Paper elevation={1} square sx={{ p: 2, borderBottom: '2px solid', borderBottomColor: 'primary.main', bgcolor: 'grey.50' }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {statusButtons.primary}
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {statusButtons.secondary}
                  </Stack>
                </Stack>
              </Paper>

              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  justifyContent="space-between"
                >
                  <Box sx={{ borderLeft: 4, borderLeftColor: 'primary.main', pl: 2 }}>
                    <Typography variant="overline" color="primary.main" sx={{ letterSpacing: 2 }}>
                      Daily Collection Report
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      DAILY COLLECTION REPORT
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 0.5 }}>
                      {selectedHeader?.lcolection_no || selectedRefno}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Date: {toDisplayDate(selectedHeader?.ldatetime) || '-'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ref No.: {selectedRefno}
                    </Typography>
                  </Box>
                  <Chip
                    label={selectedHeader?.lstatus || 'Pending'}
                    color={getStatusChipColor(selectedHeader?.lstatus)}
                  />
                </Stack>
                {error && (
                  <Paper variant="outlined" sx={(theme) => ({ mt: 2, p: 1, bgcolor: alpha(theme.palette.error.main, 0.08), borderColor: 'error.light', borderRadius: 1 })}>
                    <Typography variant="body2" color="error">
                      {error}
                    </Typography>
                  </Paper>
                )}
              </Box>

              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, overflow: 'auto' }}>
                {!detailLoading && canAddPayment && (
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={handleDeleteSelectedItems}
                        disabled={selectedItemIds.length === 0 || !!workingAction}
                      >
                        Delete Selected
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={handlePostSelectedItems}
                        disabled={selectedItemIds.length === 0 || !!workingAction}
                      >
                        Post Selected
                      </Button>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <TextField
                        size="small"
                        type="date"
                        label="Collection Date"
                        InputLabelProps={{ shrink: true }}
                        value={form.collectDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, collectDate: e.target.value }))}
                      />
                      <Chip label={form.status} color={getStatusChipColor(form.status)} />
                    </Stack>
                  </Stack>
                )}

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 480 }}>
                  <Table stickyHeader size="small" sx={{ minWidth: 1400 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" sx={{ bgcolor: 'grey.800' }}>
                          <Checkbox
                            checked={allSelectableChecked}
                            indeterminate={selectedItemIds.length > 0 && !allSelectableChecked}
                            sx={{ color: 'grey.400', '&.Mui-checked': { color: 'primary.light' } }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemIds(postableItems.map((item) => item.lid));
                              } else {
                                setSelectedItemIds([]);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Customer</TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Transaction No.</TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Check/Cash</TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Bank</TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Check Number</TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Check Date</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Amount</TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Status</TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Remarks</TableCell>
                        <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Approval</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailLoading && (
                        <TableRow>
                          <TableCell colSpan={11} align="center">
                            Loading payment lines...
                          </TableCell>
                        </TableRow>
                      )}
                      {!detailLoading && items.length === 0 && !canAddPayment && (
                        <TableRow>
                          <TableCell colSpan={11} align="center">
                            No payment lines yet.
                          </TableCell>
                        </TableRow>
                      )}
                      {!detailLoading && items.map((item, index) => {
                        const posted = item.lpost === 1 || item.lcollection_status === 'Posted';
                        return (
                          <TableRow
                            key={item.lid}
                            sx={{
                              bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          >
                            <TableCell padding="checkbox" sx={{ py: 1 }}>
                              <Checkbox
                                checked={selectedItemIds.includes(item.lid)}
                                disabled={posted}
                                onChange={(e) => {
                                  setSelectedItemIds((prev) => (
                                    e.target.checked ? [...prev, item.lid] : prev.filter((id) => id !== item.lid)
                                  ));
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1 }}>{item.lcustomer_fname || item.lcustomer || '-'}</TableCell>
                            <TableCell sx={{ py: 1 }}>{item.ltransaction_no || '-'}</TableCell>
                            <TableCell sx={{ py: 1 }}>{item.ltype || '-'}</TableCell>
                            <TableCell sx={{ py: 1 }}>{item.lbank || '-'}</TableCell>
                            <TableCell sx={{ py: 1 }}>{item.lchk_no || '-'}</TableCell>
                            <TableCell sx={{ py: 1 }}>{item.lchk_date ? toDisplayDate(item.lchk_date) : '-'}</TableCell>
                            <TableCell align="right" sx={{ py: 1 }}>{peso.format(item.lamt || 0)}</TableCell>
                            <TableCell sx={{ py: 1 }}>
                              <Chip
                                size="small"
                                label={item.lstatus || item.lcollection_status || 'Pending'}
                                color={getStatusChipColor(item.lstatus || item.lcollection_status)}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1 }}>{item.lremarks || '-'}</TableCell>
                            <TableCell sx={{ py: 1 }}>
                              {posted ? (
                                <Chip size="small" label="Posted" color="success" />
                              ) : (
                                <Button
                                  variant="outlined"
                                  color="error"
                                  size="small"
                                  onClick={() => handleDeleteItem(item.lid)}
                                  disabled={!!workingAction}
                                >
                                  Delete
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!detailLoading && canAddPayment && (
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={allSelectableChecked}
                              indeterminate={selectedItemIds.length > 0 && !allSelectableChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItemIds(postableItems.map((item) => item.lid));
                                } else {
                                  setSelectedItemIds([]);
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 220 }}>
                            <FormControl fullWidth size="small">
                              <Select
                                displayEmpty
                                value={form.customerId}
                                onChange={(e) => setForm((prev) => ({ ...prev, customerId: String(e.target.value) }))}
                              >
                                <MenuItem value="">Customer</MenuItem>
                                {customers.map((customer) => (
                                  <MenuItem key={customer.id} value={customer.id}>
                                    {customer.code ? `${customer.code} - ` : ''}{customer.company}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ minWidth: 220 }}>
                            <FormControl fullWidth size="small">
                              <Select
                                multiple
                                displayEmpty
                                value={Object.entries(selectedTransactions).filter(([, value]) => value).map(([key]) => key)}
                                onChange={(e) => {
                                  const selected = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                                  const newSelections: Record<string, boolean> = {};
                                  unpaidRows.forEach((row) => {
                                    const key = `${row.transactionType}:${row.lrefno}`;
                                    newSelections[key] = selected.includes(key);
                                  });
                                  setSelectedTransactions(newSelections);
                                }}
                                renderValue={(selected) => {
                                  const values = selected as string[];
                                  if (values.length === 0) return 'Transaction No.';
                                  return values
                                    .map((value) => unpaidRows.find((row) => `${row.transactionType}:${row.lrefno}` === value)?.linvoice_no || value)
                                    .join(', ');
                                }}
                              >
                                {!form.customerId && <MenuItem disabled value="">Pick a customer</MenuItem>}
                                {form.customerId && unpaidRows.length === 0 && <MenuItem disabled value="">No unpaid items</MenuItem>}
                                {unpaidRows.map((row) => {
                                  const key = `${row.transactionType}:${row.lrefno}`;
                                  return (
                                    <MenuItem key={key} value={key}>
                                      {row.linvoice_no} - {peso.format(row.totalAmount || 0)}
                                    </MenuItem>
                                  );
                                })}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ minWidth: 130 }}>
                            <FormControl fullWidth size="small">
                              <Select value={form.type} onChange={(e) => handleTypeChange(String(e.target.value))}>
                                <MenuItem value="Cash">Cash</MenuItem>
                                <MenuItem value="Check">Check</MenuItem>
                                <MenuItem value="TT">TT</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ minWidth: 140 }}>
                            <TextField
                              fullWidth
                              size="small"
                              value={form.bank}
                              onChange={(e) => setForm((prev) => ({ ...prev, bank: e.target.value }))}
                              placeholder="Bank"
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 140 }}>
                            <TextField
                              fullWidth
                              size="small"
                              value={form.checkNo}
                              onChange={(e) => setForm((prev) => ({ ...prev, checkNo: e.target.value }))}
                              placeholder="Check Number"
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 150 }}>
                            <TextField
                              fullWidth
                              size="small"
                              type="date"
                              value={form.checkDate}
                              onChange={(e) => setForm((prev) => ({ ...prev, checkDate: e.target.value }))}
                              InputLabelProps={{ shrink: true }}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 140 }}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={form.amount}
                              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                              inputProps={{ step: '0.01' }}
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={form.status} color={getStatusChipColor(form.status)} />
                          </TableCell>
                          <TableCell sx={{ minWidth: 180 }}>
                            <TextField
                              fullWidth
                              size="small"
                              value={form.remarks}
                              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                              placeholder="Remarks"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={handleSavePayment}
                              disabled={savingPayment}
                            >
                              {savingPayment ? 'Saving...' : 'Add Payment'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    <TableFooter>
                      <TableRow sx={{ bgcolor: 'grey.100', borderTop: 2, borderColor: 'divider' }}>
                        <TableCell sx={{ py: 1.5, fontWeight: 700 }} />
                        <TableCell colSpan={2} sx={{ py: 1.5, fontWeight: 700 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                            Total Check: {peso.format(totalCheck)}
                          </Typography>
                        </TableCell>
                        <TableCell colSpan={2} sx={{ py: 1.5, fontWeight: 700 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                            Total T/T: {peso.format(totalTT)}
                          </Typography>
                        </TableCell>
                        <TableCell colSpan={2} sx={{ py: 1.5, fontWeight: 700 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                            Total Cash: {peso.format(totalCash)}
                          </Typography>
                        </TableCell>
                        <TableCell colSpan={3} sx={{ py: 1.5, fontWeight: 700 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary" align="right">
                            Grand Total: {peso.format(grandTotal)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </Box>

              <Dialog
                open={showApproverLogsModal}
                onClose={() => setShowApproverLogsModal(false)}
                fullWidth
                maxWidth="lg"
              >
                <DialogTitle>Approver Logs</DialogTitle>
                <DialogContent dividers>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>ID</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Approver Name</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Date & Time</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Remark</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {approverLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              No approver logs yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          approverLogs.map((log, index) => (
                            <TableRow
                              key={log.lid}
                              sx={{ bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50' }}
                            >
                              <TableCell>{log.lid}</TableCell>
                              <TableCell>
                                {((log.staff_fName || '') + ' ' + (log.staff_lName || '')).trim() || log.lstaff_id}
                              </TableCell>
                              <TableCell>{log.ldatetime || '-'}</TableCell>
                              <TableCell>{log.lremarks || '-'}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={log.lstatus || 'Pending'}
                                  color={getStatusChipColor(log.lstatus)}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setShowApproverLogsModal(false)}>Close</Button>
                </DialogActions>
              </Dialog>
            </>
          )}
        </Paper>
      </Box>
      <DeleteCollectionReportModal
        isOpen={showDeleteReportModal}
        onClose={() => setShowDeleteReportModal(false)}
        onConfirm={handleDeleteCollectionReport}
        refNo={selectedRefno}
        itemCount={items.length}
      />
    </Box>
  );
};

export default DailyCollectionEntryView;
