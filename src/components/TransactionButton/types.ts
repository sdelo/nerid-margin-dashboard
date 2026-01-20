export interface TransactionInfo {
  action: string;              // e.g., "Deposit SUI"
  packageId: string;           // e.g., "0x7a2b...c4f3"
  module: string;              // e.g., "margin_pool"
  function: string;            // e.g., "supply"
  summary: string;             // Description of what the transaction does
  sourceCodeUrl: string;       // SuiVision link
  arguments?: Array<{          // Optional: show transaction args
    name: string;
    value: string;
  }>;
}

export interface TransactionButtonProps {
  // Visual props
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  
  // Transaction info
  transactionInfo: TransactionInfo;
  
  // Callback
  onContinue: () => void;
}

export interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  transactionInfo: TransactionInfo;
  disabled?: boolean; // New prop to disable the continue button
}

