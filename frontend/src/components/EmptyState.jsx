import { Box, Typography, Button } from '@mui/material'

export default function EmptyState({
  icon = '📦',
  title = 'No data',
  subtitle = 'Nothing to display yet.',
  actionLabel = '',
  onAction,
  canAct = true,
}) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 8,
        px: 2,
        borderRadius: 3,
        border: '1px dashed #2a2d3e',
        bgcolor: '#16171f',
      }}
    >
      <Typography sx={{ fontSize: 36, mb: 1 }}>{icon}</Typography>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: actionLabel ? 2 : 0 }}>
        {subtitle}
      </Typography>
      {actionLabel && (
        <Button
          variant="contained"
          onClick={onAction}
          disabled={!canAct}
          sx={{ bgcolor: '#6BCB77', color: '#13141a', '&:hover': { bgcolor: '#5ab868' } }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}
