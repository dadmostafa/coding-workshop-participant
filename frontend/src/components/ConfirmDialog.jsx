import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button,
} from '@mui/material'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ color: 'text.primary' }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary' }}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} sx={{ color: '#8b8fa8' }}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained"
          sx={{ bgcolor: '#FF6B6B', color: '#fff', '&:hover': { bgcolor: '#e55a5a' } }}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}
