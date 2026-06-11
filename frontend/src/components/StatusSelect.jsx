import { useState } from 'react'
import { Box, Chip, Menu, MenuItem, Typography, CircularProgress } from '@mui/material'
import { CheckCircle, ExpandMore } from '@mui/icons-material'

const STATUS_CONFIG = {
  backlog:        { label: 'Backlog',        color: '#8b8fa8' },
  planning:       { label: 'Planning',       color: '#74B9FF' },
  in_progress:    { label: 'In Progress',    color: '#FFD166' },
  review:         { label: 'Review',         color: '#A29BFE' },
  completed:      { label: 'Completed',      color: '#6BCB77' },
  on_hold:        { label: 'On Hold',        color: '#FF9F43' },
  cancelled:      { label: 'Cancelled',      color: '#FF6B6B' },
}

export default function StatusSelect({ value, onChange, disabled = false }) {
  const [anchor,  setAnchor]  = useState(null)
  const [saving,  setSaving]  = useState(false)

  const cfg = STATUS_CONFIG[value] || STATUS_CONFIG.backlog

  const handleSelect = async (newStatus) => {
    if (newStatus === value) { setAnchor(null); return }
    setSaving(true)
    setAnchor(null)
    try {
      await onChange(newStatus)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Chip
        onClick={disabled ? undefined : e => { e.stopPropagation(); setAnchor(e.currentTarget) }}
        label={
          saving ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={10} sx={{ color: cfg.color }} />
              <span>{cfg.label}</span>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <span>{cfg.label}</span>
              {!disabled && <ExpandMore sx={{ fontSize: 13, mt: 0.1 }} />}
            </Box>
          )
        }
        size="small"
        sx={{
          bgcolor:    `${cfg.color}15`,
          color:      cfg.color,
          border:     `1px solid ${cfg.color}30`,
          fontWeight: 600,
          fontSize:   '0.7rem',
          cursor:     disabled ? 'default' : 'pointer',
          transition: 'all 0.15s ease',
          '&:hover':  disabled ? {} : {
            bgcolor: `${cfg.color}25`,
            border:  `1px solid ${cfg.color}60`,
          },
          '& .MuiChip-label': { px: 1 },
        }}
      />

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        onClick={e => e.stopPropagation()}
        PaperProps={{
          sx: {
            bgcolor: '#1e2029',
            border:  '1px solid #2a2d3e',
            borderRadius: 2,
            minWidth: 160,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }
        }}
      >
        <Typography variant="caption" sx={{
          display: 'block', px: 2, pt: 1.5, pb: 0.5,
          color: '#8b8fa8', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontSize: '0.62rem',
        }}>
          Change Status
        </Typography>

        {Object.entries(STATUS_CONFIG).map(([key, c]) => (
          <MenuItem
            key={key}
            onClick={() => handleSelect(key)}
            sx={{
              py: 0.8, px: 2, gap: 1.5,
              borderRadius: 1.5, mx: 0.5,
              '&:hover': { bgcolor: '#252736' },
            }}
          >
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: c.color, flexShrink: 0,
            }} />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {c.label}
            </Typography>
            {key === value && (
              <CheckCircle sx={{ fontSize: 14, color: '#6BCB77' }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
