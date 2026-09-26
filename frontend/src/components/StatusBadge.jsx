import React from 'react';

const StatusBadge = ({ status, type = 'document' }) => {
  if (!status) return null;

  let badgeClass = 'badge-draft';
  let label = status;

  if (type === 'document') {
    switch (status.toUpperCase()) {
      case 'DRAFT':
        badgeClass = 'badge-draft';
        break;
      case 'WAITING':
        badgeClass = 'badge-waiting';
        break;
      case 'READY':
        badgeClass = 'badge-ready';
        break;
      case 'DONE':
        badgeClass = 'badge-done';
        break;
      case 'CANCELED':
        badgeClass = 'badge-canceled';
        break;
      default:
        badgeClass = 'badge-draft';
    }
  } else if (type === 'stock') {
    switch (status.toUpperCase()) {
      case 'NORMAL':
      case 'OK':
        badgeClass = 'badge-normal';
        label = 'In Stock';
        break;
      case 'LOW_STOCK':
      case 'REORDER_NEEDED':
        badgeClass = 'badge-low';
        label = 'Low Stock';
        break;
      case 'OUT_OF_STOCK':
        badgeClass = 'badge-out';
        label = 'Out of Stock';
        break;
      case 'OVER_STOCK':
        badgeClass = 'badge-over';
        label = 'Over Stock';
        break;
      default:
        badgeClass = 'badge-normal';
    }
  } else if (type === 'movement') {
    switch (status.toUpperCase()) {
      case 'INCOMING':
        badgeClass = 'badge-done';
        label = 'Incoming (+)';
        break;
      case 'OUTGOING':
        badgeClass = 'badge-canceled';
        label = 'Outgoing (-)';
        break;
      case 'TRANSFER':
        badgeClass = 'badge-ready';
        label = 'Transfer (↔)';
        break;
      case 'ADJUSTMENT':
        badgeClass = 'badge-waiting';
        label = 'Adjustment (±)';
        break;
      default:
        badgeClass = 'badge-draft';
    }
  }

  return (
    <span className={`badge ${badgeClass}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
