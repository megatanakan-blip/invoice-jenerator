export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  senderCompany: string;
  senderRepresentative: string;
  senderAddress: string;
  senderPhone: string;
  senderEmail: string;
  recipient: string;
  recipientPerson: string;
  invoiceNo: string;
  invoiceDate: string;
  subject: string;
  items: InvoiceItem[];
  bankDetails: string;
  remarks: string;
  userId?: string;
}

export interface SenderProfile {
  id?: string;
  profileName: string; // 例: 会社用, 副業用, 個人用
  senderCompany: string;
  senderRepresentative: string;
  senderAddress: string;
  senderPhone: string;
  senderEmail: string;
  bankDetails: string;
  remarks: string;
  isDefault?: boolean;
  userId?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface RecipientClient {
  id: string;
  companyName: string;
  contactPerson: string;
  notes?: string;
  userId?: string;
  createdAt?: string;
}
