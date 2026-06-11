import { Box, Typography, Tooltip, LinearProgress } from '@mui/material'

/**
 * UtilizationBar — shows resource utilization as a colored progress bar.
 */
export default function UtilizationBar({
  pct = 0,
  days = 0,
  capacity = 20,
  showLabel = true,
  height = 6,
  compact = false,
}) {
  const color =
    pct > 100 ? '#FF6B6B' :
    pct >= 80 ? '#FF9F43' :
    pct >= 50 ? '#6BCB77' :
    '#8b8fa8'

  const label =
    pct > 100 ? 'Over-allocated' :
    pct >= 80 ? 'High load' :
    pct >= 50 ? 'Optimal' :
    'Available'

  const tooltipText = `${days} of ${capacity} days allocated (${pct}%) — ${label}`

  return (
    <Tooltip title={tooltipText} arrow placement="top">
      <Box sx={{ width: '100%', minWidth: compact ? 60 : 80 }}>
        {showLabel && !compact && (
          <Box sx={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', mb: 0.4,
          }}>
            <Typography variant="caption"
              sx={{ color, fontWeight: pct > 100 ? 700 : 500, fontSize: '0.72rem' }}>
              {pct}%
            </Typography>
            <Typography variant="caption" color="text.secondary"
              sx={{ fontSize: '0.65rem' }}>
              {days}d / {capacity}d
            </Typography>
          </Box>
        )}

        <Box sx={{ position: 'relative' }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, pct)}
            sx={{
              height,
              borderRadius: height,
              bgcolor: '#252736',
              '& .MuiLinearProgress-bar': {
                bgcolor: color,
                borderRadius: height,
                transition: 'width 0.4s ease',
              },
            }}
          />
          {pct > 100 && (
            <Box sx={{
              position: 'absolute', right: 0, top: '50%',
              transform: 'translateY(-50%)',
              width: 6, height: height + 4,
              bgcolor: '#FF6B6B',
              borderRadius: 1,
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.4 },
              },
            }} />
          )}
        </Box>

        {showLabel && compact && (
          <Typography variant="caption"
            sx={{ color, fontWeight: pct > 100 ? 700 : 400, fontSize: '0.65rem' }}>
            {pct}%
          </Typography>
        )}
      </Box>
    </Tooltip>
  )
}
