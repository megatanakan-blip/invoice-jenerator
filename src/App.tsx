/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { InvoiceData, InvoiceItem, SenderProfile } from './types';
import {
  Printer,
  Plus,
  Trash2,
  Save,
  List,
  FolderOpen,
  UserCheck,
  Building2,
  Settings,
  ChevronDown,
  Cloud,
  CheckCircle2,
  ExternalLink,
  LogOut,
  LogIn,
  Download,
  Image as ImageIcon,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { db, auth, googleProvider } from './firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  where,
} from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { RecipientManagerModal } from './components/RecipientManagerModal';
import { handleFirestoreError, OperationType } from './lib/firestoreErrors';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setLoginError(false);
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      setLoginError(true);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 font-bold">読み込み中...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100/70 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200/80 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">請求書作成アプリ</h1>
          <p className="text-slate-500 text-sm mb-8">Googleアカウントでログインして、あなた専用の自社情報や取引先を安全に管理しましょう。</p>
          {loginError && (
            <div className="mb-4 text-red-600 text-sm font-semibold bg-red-50 p-2 rounded">
              ログインに失敗しました。もう一度お試しください。
            </div>
          )}
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-sm cursor-pointer"
          >
            <LogIn size={20} /> Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return <MainApp user={user} logout={logout} />;
}

function MainApp({ user, logout }: { user: User, logout: () => void }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<{ id: string; companyName: string; contactPerson: string }[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<SenderProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [invoice, setInvoice] = useState<InvoiceData>(() => {
    const savedDraft = localStorage.getItem(`invoice_draft_${user.uid}`);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft);
      } catch (e) {
        console.error('Error parsing invoice draft:', e);
      }
    }
    return {
      senderCompany: '株式会社ビデオチューブ',
      senderRepresentative: '代表取締役 山田 太郎',
      senderAddress: '東京都渋谷区...',
      senderPhone: '03-xxxx-xxxx',
      senderEmail: 'info@videotube.co.jp',
      recipient: '',
      recipientPerson: '',
      invoiceNo: '2026-001',
      invoiceDate: new Date().toISOString().split('T')[0],
      subject: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      bankDetails: '',
      remarks: '',
    };
  });

  const [showPreview, setShowPreview] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingJPG, setIsExportingJPG] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<{ id: string; no: string } | null>(null);

  const getExportFilename = (extension: string) => {
    const safeRecipient = invoice.recipient ? invoice.recipient.replace(/[\/\\]/g, '_') : '請求先未定';
    return `請求書_${safeRecipient}_${invoice.invoiceNo}.${extension}`;
  };

  const captureInvoiceElement = async () => {
    const element = document.getElementById('invoice-printable-sheet');
    if (!element) return null;
    
    // Temporarily ensure the element is displayed for html2canvas
    const wasHidden = !showPreview;
    if (wasHidden) {
      setShowPreview(true);
      // Wait for React to render the preview before capturing
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    try {
      const canvas = await toCanvas(element, {
        pixelRatio: 2, // High resolution
        backgroundColor: '#ffffff'
      });
      return canvas;
    } finally {
      if (wasHidden) {
        setShowPreview(false);
      }
    }
  };

  const exportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const canvas = await captureInvoiceElement();
      if (!canvas) throw new Error("プレビューが見つかりません");
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(getExportFilename('pdf'));
      
      setSaveSuccessNotice('PDFを出力しました。');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } catch (err) {
      console.error(err);
      alert("PDFの出力に失敗しました。");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const exportJPG = async () => {
    setIsExportingJPG(true);
    try {
      const canvas = await captureInvoiceElement();
      if (!canvas) throw new Error("プレビューが見つかりません");
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = getExportFilename('jpg');
      link.click();
      
      setSaveSuccessNotice('JPG画像を出力しました。');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } catch (err) {
      console.error(err);
      alert("JPGの出力に失敗しました。");
    } finally {
      setIsExportingJPG(false);
    }
  };

  // Real-time Load Multiple Sender Profiles from Firebase (company, side-business, personal)
  useEffect(() => {
    const path = 'sender_profiles';
    const q = query(
      collection(db, 'sender_profiles'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: SenderProfile[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SenderProfile, 'id'>),
        }));

        setSenderProfiles(list);
        localStorage.setItem(`saved_sender_profiles_${user.uid}`, JSON.stringify(list));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Auto-save typed inputs to local draft on changes
  useEffect(() => {
    localStorage.setItem(`invoice_draft_${user.uid}`, JSON.stringify(invoice));
  }, [invoice, user.uid]);

  // Real-time Load Invoices list from Firebase
  useEffect(() => {
    const path = 'invoices';
    const q = query(
      collection(db, 'invoices'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setInvoices(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return () => unsubscribe();
  }, [user.uid]);

  // Real-time Load Registered Recipients list for quick selector
  useEffect(() => {
    const path = 'recipients';
    const q = query(
      collection(db, 'recipients'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          companyName: d.data().companyName || '',
          contactPerson: d.data().contactPerson || '',
        }));
        setRecipients(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return () => unsubscribe();
  }, [user.uid]);

  const totalAmount = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const saveInvoice = async () => {
    setIsSaving(true);
    // Save invoice document directly into Firebase invoices collection
    const invoicesPath = 'invoices';
    try {
      await addDoc(collection(db, 'invoices'), {
        ...invoice,
        totalAmount,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setSaveSuccessNotice('Firebaseクラウドに請求書を保存しました！');
      setTimeout(() => setSaveSuccessNotice(null), 3500);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, invoicesPath);
      alert('保存に失敗しました。ネットワーク状況をご確認ください。');
    } finally {
      setIsSaving(false);
    }
  };

  const loadInvoiceFromHistory = (hist: any) => {
    const { id, createdAt, userId, totalAmount: _, ...rest } = hist;
    setInvoice(rest as InvoiceData);
    setShowList(false);
    setSaveSuccessNotice('履歴から請求書データを復元しました。');
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  const deleteInvoiceFromHistory = async (id: string) => {
    const path = `invoices/${id}`;
    try {
      await deleteDoc(doc(db, 'invoices', id));
      setSaveSuccessNotice('請求書を履歴から削除しました。');
      setTimeout(() => setSaveSuccessNotice(null), 2500);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
      setSaveSuccessNotice('削除に失敗しました。');
      setTimeout(() => setSaveSuccessNotice(null), 2500);
    }
  };

  const confirmDeleteInvoice = () => {
    if (invoiceToDelete) {
      deleteInvoiceFromHistory(invoiceToDelete.id);
      setInvoiceToDelete(null);
    }
  };

  const addItem = () => {
    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }],
    }));
  };

  const removeItem = (id: string) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const handleApplySenderProfile = (profile: SenderProfile) => {
    if (profile.id) {
      setActiveProfileId(profile.id);
    }
    setInvoice((prev) => ({
      ...prev,
      senderCompany: profile.senderCompany,
      senderRepresentative: profile.senderRepresentative,
      senderAddress: profile.senderAddress,
      senderPhone: profile.senderPhone,
      senderEmail: profile.senderEmail,
      bankDetails: profile.bankDetails || prev.bankDetails,
      remarks: profile.remarks || prev.remarks,
    }));
    setSaveSuccessNotice(`自社プロファイル「${profile.profileName}」を請求書に反映しました。`);
    setTimeout(() => setSaveSuccessNotice(null), 3500);
  };

  const handleSelectRecipient = (rec: { companyName: string; contactPerson: string }) => {
    setInvoice((prev) => ({
      ...prev,
      recipient: rec.companyName,
      recipientPerson: rec.contactPerson,
    }));
    setSaveSuccessNotice(`請求先「${rec.companyName}」を反映しました。`);
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 md:p-6 print:p-0 print:bg-white text-gray-800">
      <div className="print:hidden max-w-4xl mx-auto bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200/80 mb-8">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 mb-5 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>請求書作成・管理</span>
            </h1>
            <p className="hidden sm:block text-xs text-slate-500 mt-0.5">
              パーソナルデータと請求先を登録してスマートに請求書を作成・A4印刷
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/90 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-left shadow-2xs flex-1 sm:flex-none">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1 truncate">
                  <Cloud size={13} className="text-emerald-600 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-medium hidden sm:block">
                  クラウド保存・同期
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 transition cursor-pointer shadow-2xs shrink-0"
            >
              <LogOut size={14} /> <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>

        {/* Quick Registration & Management Toolbar */}
        <div className="mb-5 sm:mb-6 p-2.5 sm:p-3.5 bg-gradient-to-r from-slate-50 to-blue-50/40 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <span className="hidden sm:flex text-xs font-bold text-slate-700 uppercase tracking-wider items-center gap-1">
              <Settings size={14} className="text-slate-500" /> 設定:
            </span>

            {/* Personal Data Registration Button */}
            <button
              id="open-profile-settings-btn"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex justify-center items-center gap-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-800 text-[11px] sm:text-xs font-semibold px-2 sm:px-3.5 py-2 rounded-lg shadow-2xs hover:border-blue-300 transition cursor-pointer"
            >
              <UserCheck size={14} className="text-blue-600 shrink-0" />
              <span className="truncate">自社情報</span>
              {senderProfiles.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0">
                  {senderProfiles.length}
                </span>
              )}
            </button>

            {/* Recipient Management Button */}
            <button
              id="open-recipient-manager-btn"
              onClick={() => setIsRecipientModalOpen(true)}
              className="flex justify-center items-center gap-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] sm:text-xs font-semibold px-2 sm:px-3.5 py-2 rounded-lg shadow-2xs hover:border-emerald-300 transition cursor-pointer"
            >
              <Building2 size={14} className="text-emerald-600 shrink-0" />
              <span className="truncate">請求先管理</span>
              {recipients.length > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0">
                  {recipients.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden sm:flex text-[11px] text-slate-600 items-center gap-1.5">
            <span className="flex items-center gap-1.5 text-emerald-800 font-medium bg-emerald-100/70 px-2.5 py-1 rounded-md border border-emerald-200/80">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              Firebaseデータベースに直接自動同期中
            </span>
          </div>
        </div>

        {saveSuccessNotice && (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center justify-between animate-fade-in">
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 size={14} className="text-emerald-600" />
              {saveSuccessNotice}
            </span>
            <button onClick={() => setSaveSuccessNotice(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 cursor-pointer">✕</button>
          </div>
        )}

        {/* History restore shortcut */}
        {invoices.length > 0 && (
          <div className="mb-5 p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
            <span className="text-indigo-800 font-medium">
              💡 直近で保存した請求書履歴（{invoices[0].invoiceDate} 発行 / {invoices[0].recipient || '名称なし'}）からフォームを復元できます。
            </span>
            <button
              id="restore-last-history-btn"
              onClick={() => loadInvoiceFromHistory(invoices[0])}
              className="w-fit flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-1 px-3 rounded-lg text-xs transition shadow-2xs cursor-pointer whitespace-nowrap"
            >
              <FolderOpen size={13} /> 前回履歴から復元
            </button>
          </div>
        )}

        {/* SECTION 1: Recipient (Client) Info */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 size={16} className="text-emerald-600" /> 請求先情報
            </h2>

            {/* Registered recipients quick select dropdown */}
            {recipients.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">登録済みから選択:</span>
                <div className="relative inline-block">
                  <select
                    id="quick-select-recipient"
                    className="text-xs bg-white border border-slate-300 rounded-lg py-1 px-2.5 pr-6 text-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer appearance-none"
                    value=""
                    onChange={(e) => {
                      const selected = recipients.find((r) => r.id === e.target.value);
                      if (selected) {
                        handleSelectRecipient(selected);
                      }
                    }}
                  >
                    <option value="" disabled>
                      請求先を選択して自動入力...
                    </option>
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.companyName} {r.contactPerson ? `(${r.contactPerson})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">宛先 (会社名 / 屋号)</label>
              <input
                id="recipient-input"
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="例: 株式会社〇〇 御中"
                value={invoice.recipient}
                onChange={(e) => setInvoice({ ...invoice, recipient: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ご担当者様名</label>
              <input
                id="recipient-person-input"
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="例: 田中 太郎 様"
                value={invoice.recipientPerson}
                onChange={(e) => setInvoice({ ...invoice, recipientPerson: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">件名</label>
              <input
                id="subject-input"
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="例: 2026年5月度 業務委託料のご請求"
                value={invoice.subject}
                onChange={(e) => setInvoice({ ...invoice, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">発行日</label>
              <input
                id="invoice-date-input"
                type="date"
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                value={invoice.invoiceDate}
                onChange={(e) => setInvoice({ ...invoice, invoiceDate: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Sender (Personal) Info */}
        <div className="mb-6 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck size={16} className="text-blue-600" /> 請求元（自社・パーソナル情報）
              </h2>
              {senderProfiles.length > 0 && (
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  登録: {senderProfiles.length}件
                </span>
              )}
            </div>

            <button
              id="edit-profile-inline-btn"
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline decoration-blue-300 underline-offset-2 cursor-pointer self-start sm:self-auto"
            >
              自社プロファイル（会社用・副業用・個人用）を管理・追加
            </button>
          </div>

          {/* Sender profile quick switchers */}
          {senderProfiles.length > 0 ? (
            <div className="mb-3.5 p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mr-1">
                  自社プロファイル切替:
                </span>
                {senderProfiles.map((p) => {
                  const isSelected = activeProfileId === p.id || invoice.senderCompany === p.senderCompany;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplySenderProfile(p)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-blue-100/60 border border-blue-200'
                      }`}
                      title={`${p.senderCompany} (${p.senderRepresentative})`}
                    >
                      <span>{p.profileName}</span>
                      {p.isDefault && (
                        <span className={`text-[9px] px-1 rounded ${isSelected ? 'bg-blue-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                          標準
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-100/50 transition cursor-pointer"
              >
                <Plus size={12} /> 追加・編集
              </button>
            </div>
          ) : (
            <div className="mb-3.5 p-2.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600">
              <span>💡 会社用、副業用、個人用などのパーソナルデータを保存しておくと、ここからワンタップで切り替えられます。</span>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="text-blue-600 hover:text-blue-800 font-bold whitespace-nowrap cursor-pointer"
              >
                + 登録する
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">弊社名 / 屋号 (必須)</label>
              <input
                id="sender-company-input"
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="弊社名"
                value={invoice.senderCompany}
                onChange={(e) => setInvoice({ ...invoice, senderCompany: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">代表者名 / 請求者名 (必須)</label>
              <input
                id="sender-rep-input"
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="代表者名"
                value={invoice.senderRepresentative}
                onChange={(e) => setInvoice({ ...invoice, senderRepresentative: e.target.value })}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">住所 (必須)</label>
            <input
              id="sender-address-input"
              className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
              placeholder="住所"
              value={invoice.senderAddress}
              onChange={(e) => setInvoice({ ...invoice, senderAddress: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">電話番号 (必須)</label>
              <input
                id="sender-phone-input"
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="電話番号"
                value={invoice.senderPhone}
                onChange={(e) => setInvoice({ ...invoice, senderPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Eメール (必須)</label>
              <input
                id="sender-email-input"
                type="email"
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="メールアドレス"
                value={invoice.senderEmail}
                onChange={(e) => setInvoice({ ...invoice, senderEmail: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Bank & Remarks */}
        <div className="mb-6 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">振込先口座情報</label>
            <textarea
              id="bank-details-input"
              rows={3}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
              placeholder="振込先"
              value={invoice.bankDetails}
              onChange={(e) => setInvoice({ ...invoice, bankDetails: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">備考 / 特記事項</label>
            <textarea
              id="remarks-input"
              rows={3}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-slate-400 outline-none"
              placeholder="備考"
              value={invoice.remarks}
              onChange={(e) => setInvoice({ ...invoice, remarks: e.target.value })}
            />
          </div>
        </div>

        {/* SECTION 4: Line Items Table */}
        <div className="mb-6 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-slate-800">明細項目</h2>
            <button
              id="add-item-btn"
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Plus size={14} /> 行を追加
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-2.5">内容 / 項目名</th>
                    <th className="p-2.5 w-24">数量</th>
                    <th className="p-2.5 w-32">単価 (円)</th>
                    <th className="p-2.5 w-28 text-right">小計</th>
                    <th className="p-2.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-2">
                        <input
                          className="border border-slate-300 rounded-md p-1.5 w-full text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="品名・作業内容"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="border border-slate-300 rounded-md p-1.5 w-full text-sm text-right bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="border border-slate-300 rounded-md p-1.5 w-full text-sm text-right bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2 text-right font-medium text-slate-700">
                        ¥{(item.quantity * item.unitPrice).toLocaleString()}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                          title="行削除"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                    <td colSpan={3} className="p-3 text-right text-slate-700">合計金額 (税込):</td>
                    <td className="p-3 text-right text-lg text-emerald-700 font-mono">¥{totalAmount.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="sm:hidden bg-white p-3 space-y-3">
              {invoice.items.map((item, index) => (
                <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 relative">
                   <button
                     onClick={() => removeItem(item.id)}
                     className="absolute top-3 right-3 text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer bg-white shadow-sm border border-slate-100"
                     title="行削除"
                   >
                     <Trash2 size={14} />
                   </button>
                   
                   <div className="mb-3 pr-8">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">内容 / 項目名</label>
                      <input
                        className="border border-slate-300 rounded-md p-2 w-full text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="品名・作業内容"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3 mb-3">
                     <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">数量</label>
                       <input
                         type="number"
                         className="border border-slate-300 rounded-md p-2 w-full text-sm text-right bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                         value={item.quantity}
                         onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">単価 (円)</label>
                       <input
                         type="number"
                         className="border border-slate-300 rounded-md p-2 w-full text-sm text-right bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                         value={item.unitPrice}
                         onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                       />
                     </div>
                   </div>
                   
                   <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                     <span className="text-[10px] font-bold text-slate-500 uppercase">小計</span>
                     <span className="font-bold text-slate-700">¥{(item.quantity * item.unitPrice).toLocaleString()}</span>
                   </div>
                </div>
              ))}
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center mt-4">
                 <span className="font-bold text-emerald-800 text-sm">合計金額 (税込)</span>
                 <span className="text-lg font-bold text-emerald-700 font-mono">¥{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-2">
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              id="add-item-bottom-btn"
              onClick={addItem}
              className="flex justify-center items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-lg transition cursor-pointer"
            >
              <Plus size={15} /> 項目追加
            </button>
            <button
              id="toggle-list-btn"
              onClick={() => setShowList(!showList)}
              className="flex justify-center items-center gap-1.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer"
            >
              <List size={15} /> {showList ? '履歴を隠す' : '履歴一覧'}
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              id="save-invoice-btn"
              onClick={saveInvoice}
              disabled={isSaving}
              className="flex justify-center items-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-60 w-full sm:w-auto"
            >
              <Save size={15} /> {isSaving ? '保存中...' : 'クラウドに保存'}
            </button>
          </div>

          <button
            id="toggle-preview-btn"
            onClick={() => setShowPreview(!showPreview)}
            className="flex justify-center items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer sm:ml-auto w-full sm:w-auto"
          >
            {showPreview ? 'プレビューを閉じる' : 'A4プレビュー'}
          </button>
          
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              id="export-pdf-btn"
              onClick={exportPDF}
              disabled={isExportingPDF}
              className="flex justify-center items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <FileText size={15} /> {isExportingPDF ? '生成中...' : 'PDF保存'}
            </button>
            <button
              id="export-jpg-btn"
              onClick={exportJPG}
              disabled={isExportingJPG}
              className="flex justify-center items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <ImageIcon size={15} /> {isExportingJPG ? '生成中...' : 'JPG保存'}
            </button>
          </div>
        </div>
      </div>

      {/* Invoices List Panel */}
      {showList && (
        <div id="saved-invoices-section" className="print:hidden max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <List size={18} className="text-purple-600" /> Firebase 保存済み請求書履歴
              </h2>
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Cloud size={12} /> クラウド同期中
              </span>
            </div>
            <span className="text-xs bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full font-semibold">
              {invoices.length} 件
            </span>
          </div>

          {invoices.length === 0 ? (
            <p className="text-slate-500 text-center py-6 text-sm">保存された請求書履歴はありません。</p>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="md:hidden grid grid-cols-1 gap-4">
                {invoices.map((inv) => (
                  <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit">
                          {inv.invoiceNo || 'No.未設定'}
                        </span>
                        <span className="text-[11px] text-slate-400">{inv.invoiceDate}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">合計金額</span>
                        <span className="text-emerald-700 font-bold font-mono text-base">
                          ¥{inv.totalAmount ? inv.totalAmount.toLocaleString() : '0'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="font-bold text-slate-900 text-sm mb-1">{inv.recipient || '(宛先なし)'}</div>
                      <div className="text-xs text-slate-600 line-clamp-2">{inv.subject || '(件名なし)'}</div>
                    </div>
                    
                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => loadInvoiceFromHistory(inv)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 font-semibold py-2 px-3 rounded-lg text-xs transition cursor-pointer"
                        title="フォームに読み込む"
                      >
                        <FolderOpen size={14} /> 読込
                      </button>
                      <button
                        onClick={() => setInvoiceToDelete({ id: inv.id, no: inv.invoiceNo })}
                        className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 px-4 rounded-lg text-xs transition cursor-pointer"
                        title="履歴から削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
                      <th className="p-3 border-b border-slate-200">請求No</th>
                      <th className="p-3 border-b border-slate-200">発行日</th>
                      <th className="p-3 border-b border-slate-200">件名</th>
                      <th className="p-3 border-b border-slate-200">宛先</th>
                      <th className="p-3 border-b border-slate-200 text-right">合計金額</th>
                      <th className="p-3 border-b border-slate-200 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-slate-700 font-mono text-xs">{inv.invoiceNo || '---'}</td>
                        <td className="p-3 text-slate-700 text-xs">{inv.invoiceDate}</td>
                        <td className="p-3 text-slate-700 max-w-[160px] truncate">{inv.subject || '(件名なし)'}</td>
                        <td className="p-3 text-slate-900 font-medium">{inv.recipient || '(宛先なし)'}</td>
                        <td className="p-3 text-right text-emerald-700 font-bold font-mono">
                          ¥{inv.totalAmount ? inv.totalAmount.toLocaleString() : '0'}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => loadInvoiceFromHistory(inv)}
                              className="flex items-center gap-1 bg-purple-100 hover:bg-purple-200 text-purple-800 font-semibold py-1 px-2.5 rounded text-xs transition cursor-pointer"
                              title="フォームに読み込む"
                            >
                              <FolderOpen size={13} /> 読込
                            </button>
                            <button
                              onClick={() => setInvoiceToDelete({ id: inv.id, no: inv.invoiceNo })}
                              className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-1 px-2 rounded text-xs transition cursor-pointer"
                              title="履歴から削除"
                            >
                              <Trash2 size={13} /> 削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* A4 Printable Invoice Sheet */}
      <div className={`print:block ${showPreview ? 'block' : 'hidden'} overflow-x-auto w-full mb-8`}>
        <div className="w-[210mm] mx-auto shadow-2xl border border-slate-200 rounded-sm overflow-hidden">
          <div
            id="invoice-printable-sheet"
            className="w-[210mm] min-h-[297mm] bg-white p-[20mm] box-border"
          >
            <h1 className="text-3xl font-bold text-center tracking-widest mb-8 text-slate-900 border-b-2 border-slate-800 pb-3">
              請 求 書
            </h1>

        <div className="flex justify-between items-start mb-8 text-sm">
          <div className="border-b border-slate-400 pb-2 min-w-[240px]">
            <p className="font-bold text-xl text-slate-900 mb-1">{invoice.recipient || '御中'}</p>
            {invoice.recipientPerson && <p className="text-slate-700 text-base">{invoice.recipientPerson} 様</p>}
          </div>
          <div className="text-right text-slate-700 space-y-1">
            <p>発行日: {invoice.invoiceDate}</p>
            <p>請求No: {invoice.invoiceNo}</p>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-6 text-sm">
          <span className="font-bold text-slate-800">件名: </span>
          <span className="text-slate-900">{invoice.subject || '（未入力）'}</span>
        </div>

        <table className="w-full border-collapse border border-slate-300 mb-8 text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 p-2 text-left">内容・品目</th>
              <th className="border border-slate-300 p-2 text-right w-20">数量</th>
              <th className="border border-slate-300 p-2 text-right w-28">単価</th>
              <th className="border border-slate-300 p-2 text-right w-32">金額</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="border border-slate-300 p-2">{item.description || '-'}</td>
                <td className="border border-slate-300 p-2 text-right">{item.quantity}</td>
                <td className="border border-slate-300 p-2 text-right">¥{item.unitPrice.toLocaleString()}</td>
                <td className="border border-slate-300 p-2 text-right">
                  ¥{(item.quantity * item.unitPrice).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-slate-50 text-slate-900">
              <td colSpan={3} className="border border-slate-300 p-2.5 text-right">
                合計請求金額 (税込)
              </td>
              <td className="border border-slate-300 p-2.5 text-right text-base text-emerald-800">
                ¥{totalAmount.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="mb-4">
              <p className="font-bold text-slate-800 border-b border-slate-300 pb-1 mb-1">お振込先</p>
              <p className="whitespace-pre-wrap text-slate-700 text-xs leading-relaxed">{invoice.bankDetails || '-'}</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 border-b border-slate-300 pb-1 mb-1">備考</p>
              <p className="whitespace-pre-wrap text-slate-700 text-xs leading-relaxed">{invoice.remarks || '-'}</p>
            </div>
          </div>

          <div className="text-right text-slate-800 space-y-1 text-xs">
            <p className="font-bold text-base text-slate-900 mb-1">{invoice.senderCompany}</p>
            <p>{invoice.senderRepresentative}</p>
            <p>{invoice.senderAddress}</p>
            <p>TEL: {invoice.senderPhone}</p>
            <p>Email: {invoice.senderEmail}</p>
          </div>
        </div>
      </div>
        </div>
      </div>

      {/* Modals */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">請求書を削除しますか？</h3>
              <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                請求書番号「{invoiceToDelete.no}」を削除しようとしています。<br /><br />
                <span className="font-semibold text-red-600">警告: </span>
                法人の場合、請求書は発行日より原則7年（または5年）の保存義務があります。また、一度削除すると元に戻すことはできません。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setInvoiceToDelete(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmDeleteInvoice}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition cursor-pointer shadow-sm"
                >
                  完全に削除する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        activeProfileId={activeProfileId || undefined}
        onSelectProfile={handleApplySenderProfile}
        userId={user.uid}
      />

      <RecipientManagerModal
        isOpen={isRecipientModalOpen}
        onClose={() => setIsRecipientModalOpen(false)}
        onSelectRecipient={handleSelectRecipient}
        userId={user.uid}
      />
    </div>
  );
}
