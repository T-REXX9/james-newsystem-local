import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Download, Printer, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { fetchOldNewCustomersReport, OldNewCustomerRow } from '../services/oldNewCustomersReportService';

const formatDate = (dateValue: string): string => {
  if (!dateValue) return 'N/A';
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return dateValue;
  return dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const OldNewCustomersReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OldNewCustomerRow[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'old' | 'new',
    search: '',
    page: 1,
    perPage: 100,
  });
  const [summary, setSummary] = useState({
    oldCount: 0,
    newCount: 0,
    totalCount: 0,
    cutoffYears: 1,
    cutoffDate: '',
  });
  const [meta, setMeta] = useState({
    page: 1,
    perPage: 100,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput.trim(), page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOldNewCustomersReport(filters);
      setRows(data.items);
      setSummary(data.summary);
      setMeta({
        page: data.meta.page,
        perPage: data.meta.perPage,
        total: data.meta.total,
        totalPages: data.meta.totalPages,
      });
      if (!data.items.length && filters.search) {
        setError(`No customers matched "${filters.search}".`);
      }
    } catch (loadError) {
      setRows([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [filters]);

  const grouped = useMemo(() => {
    const oldCustomers = rows.filter((row) => row.customerType === 'old');
    const newCustomers = rows.filter((row) => row.customerType === 'new');
    return { oldCustomers, newCustomers };
  }, [rows]);

  const handleReset = () => {
    setSearchInput('');
    setError('');
    setFilters({
      status: 'all',
      search: '',
      page: 1,
      perPage: 100,
    });
  };

  const handleExport = () => {
    if (!rows.length) return;
    const headers = ['Customer Type', 'Customer Name', 'Customer Code', 'Group', 'Sales Person', 'Customer Since'];
    const escapeCsv = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        [
          row.customerType,
          row.customerName,
          row.customerCode,
          row.customerGroup,
          row.salesPerson,
          row.customerSince,
        ]
          .map((value) => escapeCsv(String(value || '')))
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `old-new-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderRows = (list: OldNewCustomerRow[], emptyMessage: string) => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading report...
              </Typography>
            </Stack>
          </TableCell>
        </TableRow>
      );
    }

    if (!list.length) {
      return (
        <TableRow>
          <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
            {emptyMessage}
          </TableCell>
        </TableRow>
      );
    }

    return list.map((row) => (
      <TableRow key={`${row.id}-${row.customerType}`} hover>
        <TableCell>{row.customerName || '-'}</TableCell>
        <TableCell>{row.customerCode || row.customerGroup || '-'}</TableCell>
        <TableCell>{row.salesPerson || '-'}</TableCell>
        <TableCell>{formatDate(row.customerSince)}</TableCell>
      </TableRow>
    ));
  };

  return (
    <Box sx={{ minHeight: '100%', bgcolor: 'background.default', p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Old/New Customers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Legacy report logic preserved, modernized for local API pagination and search.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              color="success"
              startIcon={<Download size={16} />}
              disabled={!rows.length}
              onClick={handleExport}
            >
              Export CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<Printer size={16} />}
              disabled={!rows.length}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="old-new-status-label">View</InputLabel>
              <Select
                labelId="old-new-status-label"
                label="View"
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: event.target.value as 'all' | 'old' | 'new',
                    page: 1,
                  }))
                }
              >
                <MenuItem value="all">All Customers</MenuItem>
                <MenuItem value="old">Old Only</MenuItem>
                <MenuItem value="new">New Only</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              label="Search customer"
              placeholder="Search customer, code, group, salesperson..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="old-new-per-page-label">Rows</InputLabel>
              <Select
                labelId="old-new-per-page-label"
                label="Rows"
                value={String(filters.perPage)}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    perPage: Number(event.target.value) || 100,
                    page: 1,
                  }))
                }
              >
                <MenuItem value="50">50 rows</MenuItem>
                <MenuItem value="100">100 rows</MenuItem>
                <MenuItem value="200">200 rows</MenuItem>
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1}>
              <Button variant="contained" color="inherit" startIcon={loading ? <CircularProgress size={14} /> : <RefreshCw size={16} />} onClick={() => void loadReport()}>
                Refresh
              </Button>
              <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={handleReset}>
                Reset
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {error ? <Alert severity={rows.length ? 'info' : 'warning'}>{error}</Alert> : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Card sx={{ flex: 1, borderRadius: 3, bgcolor: '#fff7ed' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Old Customers
              </Typography>
              <Typography variant="h4" fontWeight={800} color="#9a3412">
                {summary.oldCount.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, borderRadius: 3, bgcolor: '#eff6ff' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                New Customers
              </Typography>
              <Typography variant="h4" fontWeight={800} color="#1d4ed8">
                {summary.newCount.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Total Active Records
              </Typography>
              <Typography variant="h4" fontWeight={800}>
                {summary.totalCount.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Cutoff Date
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {formatDate(summary.cutoffDate)}
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#fcfcfd' }}>
          <Typography variant="body2" color="text.secondary">
            Old customers are active customer records with a customer-since date older than {summary.cutoffYears} year.
            New customers are active customer records created within the last {summary.cutoffYears} year.
          </Typography>
        </Paper>

        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h6" fontWeight={800}>
                Old Customers
              </Typography>
              <Chip size="small" label={grouped.oldCustomers.length} sx={{ bgcolor: '#ffedd5', color: '#9a3412', fontWeight: 700 }} />
            </Stack>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fff7ed' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Code / Group</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Salesman</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Since</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>{renderRows(grouped.oldCustomers, 'No old customers for the selected filters.')}</TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h6" fontWeight={800}>
                New Customers
              </Typography>
              <Chip size="small" label={grouped.newCustomers.length} sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />
            </Stack>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#eff6ff' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Code / Group</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Salesman</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Since</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>{renderRows(grouped.newCustomers, 'No new customers for the selected filters.')}</TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Showing {rows.length.toLocaleString()} of {meta.total.toLocaleString()} record(s)
          </Typography>
          <Pagination
            color="primary"
            page={meta.page}
            count={Math.max(1, meta.totalPages)}
            onChange={(_, page) => setFilters((prev) => ({ ...prev, page }))}
            disabled={loading}
          />
        </Stack>
      </Stack>
    </Box>
  );
};

export default OldNewCustomersReport;
