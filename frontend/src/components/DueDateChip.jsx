import { Chip, Tooltip } from '@mui/material'
import { getDueDateStatus, formatDate } from '../utils/time'

export default function DueDateChip({ date, status = '', showTooltip = true }) {
  if (!date) return null

  const ds = getDueDateStatus(date, status)
  if (!ds) return null

  const chip = (
    <Chip
      label={`${ds.icon} ${ds.label}`}
      size="small"
      sx={{
        bgcolor:    ds.bg,
        color:      ds.color,
        border:     `1px solid ${ds.color}25`,
        fontSize:   '0.68rem',
        fontWeight: ds.type === 'overdue' || ds.type === 'today' ? 700 : 500,
        height:     22,
        '& .MuiChip-label': { px: 1 },
        animation: ds.type === 'overdue'
          ? 'none' : 'none',
      }}
    />
  )

  if (!showTooltip) return chip

  return (
    <Tooltip title={`Due: ${formatDate(date)}`} arrow>
      {chip}
    </Tooltip>
  )
}
