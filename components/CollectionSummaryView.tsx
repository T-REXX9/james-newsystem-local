import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
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
import { CreditCard, FileText } from 'lucide-react';
import {
  CollectionSummaryDateType,
  CollectionSummaryResponse,
  dailyCollectionService,
} from '../services/dailyCollectionService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: CollectionSummaryDateType; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Date' },
];

const formatDate = (value?: string): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US');
};

const formatTimestamp = (value?: Date | null): string => {
  if (!value) return '-';
  return value.toLocaleString('en-US');
};

const CollectionSummaryView: React.FC = () => {
  const [dateType, setDateType] = useState<CollectionSummaryDateType>('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<CollectionSummaryResponse | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const reportRangeLabel = useMemo(() => {
    if (!report) return '';
    return `FROM ${formatDate(report.date_from)} TO ${formatDate(report.date_to)}`;
  }, [report]);

  const generate = async () => {
    if (dateType === 'custom' && (!dateFrom || !dateTo)) {
      setError('Custom date range requires Date From and Date To');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await dailyCollectionService.getSummary({
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
        limit: 200,
      });
      setReport(payload);
      setGeneratedAt(new Date());
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load collection summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
  }, []);

  const handleBackToOption = () => {
    setReport(null);
  };

  return (
    <Box sx={{ minHeight: '100%', bgcolor: '#f3f4f6', p: 2 }}>
      <Stack spacing={2}>
        <Paper
          elevation={3}
          sx={{ borderRadius: 3, p: 3, borderTop: '4px solid', borderTopColor: 'primary.main' }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="overline" color="primary.main" sx={{ letterSpacing: 2 }}>
                Collection Report
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                Collection Summary
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'flex-end' }} flexWrap="wrap" useFlexGap>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Date Type</Typography>
                <Select value={dateType} onChange={(e) => setDateType(e.target.value as CollectionSummaryDateType)}>
                  {dateTypeOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box
                sx={{
                  display: dateType === 'custom' ? 'flex' : 'none',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <TextField
                  size="small"
                  type="date"
                  label="Date From"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <FileText size={16} />
                      </InputAdornment>
                    ),
                  }}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={dateType !== 'custom'}
                />
                <TextField
                  size="small"
                  type="date"
                  label="Date To"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <FileText size={16} />
                      </InputAdornment>
                    ),
                  }}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={dateType !== 'custom'}
                />
              </Box>

              <Button
                variant="contained"
                color="primary"
                onClick={generate}
                disabled={loading}
                size="large"
                sx={{ px: 4 }}
              >
                Generate Report
              </Button>

              {report ? (
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" color="success" onClick={handleBackToOption}>
                    Back to Option
                  </Button>
                  <Button variant="outlined" onClick={() => window.print()}>
                    Print Preview
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        </Paper>

        <Paper elevation={3} sx={{ borderRadius: 3, p: 3 }}>
          <Stack spacing={3}>
            {error && (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            )}

            {loading && (
              <Typography variant="body2" color="text.secondary">
                Generating report...
              </Typography>
            )}

            {!report || loading ? null : (
              <>
                <Box
                  sx={{
                    bgcolor: 'grey.50',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    py: 2,
                    px: 3,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h5" align="center" fontWeight={700}>
                    COLLECTION SUMMARY
                  </Typography>
                  <Divider sx={{ my: 1, borderColor: 'primary.main', borderBottomWidth: 2 }} />
                  <Typography variant="subtitle2" align="center">
                    {reportRangeLabel}
                  </Typography>
                  <Typography variant="caption" align="center" sx={{ display: 'block' }}>
                    System generated {formatTimestamp(generatedAt)}
                  </Typography>
                </Box>

                <Box>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Date</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Customer</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>DCR No.</TableCell>
                          <TableCell align="right" sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Cash</TableCell>
                          <TableCell align="right" sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Check</TableCell>
                          <TableCell align="right" sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>T/T</TableCell>
                          <TableCell align="right" sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Less</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Remarks</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {report.collection_items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              No collection rows found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          report.collection_items.map((row, index) => (
                            <TableRow
                              key={`${row.dcr_no}-${index}`}
                              sx={{
                                bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            >
                              <TableCell>{formatDate(row.date)}</TableCell>
                              <TableCell>{row.customer || '-'}</TableCell>
                              <TableCell>{row.dcr_no || '-'}</TableCell>
                              <TableCell align="right">{peso.format(row.cash || 0)}</TableCell>
                              <TableCell align="right">{peso.format(row.check || 0)}</TableCell>
                              <TableCell align="right">{peso.format(row.tt || 0)}</TableCell>
                              <TableCell align="right">{peso.format(row.less || 0)}</TableCell>
                              <TableCell>{row.remarks || '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      <TableFooter>
                        <TableRow sx={{ bgcolor: 'grey.100', borderTop: 2, borderColor: 'divider' }}>
                          <TableCell colSpan={3} sx={{ fontWeight: 700, color: 'error.main', py: 1.5 }}>
                            GRAND TOTAL
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main', py: 1.5 }}>
                            {peso.format(report.collection_totals.cash || 0)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main', py: 1.5 }}>
                            {peso.format(report.collection_totals.check || 0)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main', py: 1.5 }}>
                            {peso.format(report.collection_totals.tt || 0)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main', py: 1.5 }}>
                            {peso.format(report.collection_totals.less || 0)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                </Box>

                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <CreditCard size={18} />
                    <Chip
                      label="DEBIT MEMO (DM) SUMMARY"
                      variant="outlined"
                      color="primary"
                      sx={{ fontWeight: 700, letterSpacing: 1 }}
                    />
                  </Stack>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>DM No.</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Code</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Name</TableCell>
                          <TableCell sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Date</TableCell>
                          <TableCell align="right" sx={{ bgcolor: 'grey.800', color: 'common.white', fontWeight: 700, whiteSpace: 'nowrap', py: 1.25 }}>Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {report.debit_items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              No debit memo rows found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          report.debit_items.map((row, index) => (
                            <TableRow
                              key={row.lrefno || row.ldm_no}
                              sx={{
                                bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            >
                              <TableCell>{row.ldm_no || '-'}</TableCell>
                              <TableCell>{row.lcustomer_code || '-'}</TableCell>
                              <TableCell>{row.lcustomer_name || '-'}</TableCell>
                              <TableCell>{formatDate(row.ldatetime)}</TableCell>
                              <TableCell align="right">{peso.format(row.lamount || 0)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      <TableFooter>
                        <TableRow sx={{ bgcolor: 'grey.100', borderTop: 2, borderColor: 'divider' }}>
                          <TableCell colSpan={4} sx={{ fontWeight: 700, py: 1.5 }}>
                            TOTAL
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                            {peso.format(report.debit_totals.amount || 0)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};

export default CollectionSummaryView;
