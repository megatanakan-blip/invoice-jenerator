import { useState, useEffect, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { RecipientClient } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { Building2, Plus, Trash2, Check, UserPlus, AlertCircle } from 'lucide-react';

interface RecipientManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRecipient: (recipient: { companyName: string; contactPerson: string }) => void;
  userId: string;
}

export function RecipientManagerModal({
  isOpen,
  onClose,
  onSelectRecipient,
  userId,
}: RecipientManagerModalProps) {
  const [recipients, setRecipients] = useState<RecipientClient[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [notes, setNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const path = 'recipients';
    const q = query(
      collection(db, 'recipients'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RecipientClient, 'id'>),
        }));
        setRecipients(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleAddRecipient = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMsg('会社名・請求先名を入力してください。');
      return;
    }

    setIsAdding(true);
    setErrorMsg(null);
    const path = 'recipients';

    try {
      await addDoc(collection(db, 'recipients'), {
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        notes: notes.trim(),
        userId,
        createdAt: new Date().toISOString(),
      });
      setCompanyName('');
      setContactPerson('');
      setNotes('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      setErrorMsg('登録に失敗しました。');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRecipient = async (id: string, name: string) => {
    const path = `recipients/${id}`;
    try {
      await deleteDoc(doc(db, 'recipients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      setErrorMsg('削除に失敗しました。');
    }
  };

  return (
    <div id="recipient-manager-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div id="recipient-manager-modal" className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">請求先（クライアント）の登録・管理</h2>
              <p className="text-xs text-gray-500">取引先を登録しておくと、ワンクリックで請求書に反映できます</p>
            </div>
          </div>
          <button
            id="close-recipient-modal-btn"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* New Recipient Form */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-1.5">
              <UserPlus size={16} className="text-emerald-600" /> 新しい請求先を追加
            </h3>

            {errorMsg && (
              <div className="mb-3 p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-1.5">
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddRecipient} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">宛先会社名・組織名 <span className="text-red-500">*</span></label>
                  <input
                    id="new-recipient-company"
                    required
                    placeholder="例: 株式会社クライアント"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">ご担当者様名 (任意)</label>
                  <input
                    id="new-recipient-person"
                    placeholder="例: 山本 一郎 様"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">メモ (任意)</label>
                <input
                  id="new-recipient-notes"
                  placeholder="例: 毎月末締め翌月末払い、デザイン案件担当"
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <button
                  id="submit-add-recipient-btn"
                  type="submit"
                  disabled={isAdding}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-sm transition cursor-pointer"
                >
                  <Plus size={14} />
                  {isAdding ? '追加中...' : '請求先リストに追加'}
                </button>
              </div>
            </form>
          </div>

          {/* Registered Recipients List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Building2 size={16} className="text-gray-600" /> 登録済み請求先一覧
              </h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                {recipients.length} 件
              </span>
            </div>

            {recipients.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Building2 size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">まだ請求先が登録されていません。</p>
                <p className="text-xs text-gray-400 mt-1">上のフォームから請求先を登録すると、いつでも簡単に呼び出せます。</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase border-b border-gray-200">
                      <tr>
                        <th className="p-3">会社名 / 宛先</th>
                        <th className="p-3">担当者名</th>
                        <th className="p-3">メモ</th>
                        <th className="p-3 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recipients.map((rec) => (
                        <tr key={rec.id} className="hover:bg-gray-50/80 transition">
                          <td className="p-3 font-medium text-gray-900">{rec.companyName}</td>
                          <td className="p-3 text-gray-600">{rec.contactPerson || '-'}</td>
                          <td className="p-3 text-gray-500 text-xs max-w-xs truncate">{rec.notes || '-'}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  onSelectRecipient({
                                    companyName: rec.companyName,
                                    contactPerson: rec.contactPerson || '',
                                  });
                                  onClose();
                                }}
                                className="flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold py-1 px-2.5 rounded text-xs transition cursor-pointer"
                                title="この宛先を請求書に反映"
                              >
                                <Check size={13} /> 選択反映
                              </button>
                              <button
                                onClick={() => {
                                  if (confirmDeleteId === rec.id) {
                                    handleDeleteRecipient(rec.id, rec.companyName);
                                    setConfirmDeleteId(null);
                                  } else {
                                    if (rec.id) {
                                      setConfirmDeleteId(rec.id);
                                      setTimeout(() => setConfirmDeleteId(null), 3000);
                                    }
                                  }
                                }}
                                className={`flex items-center gap-1 p-1.5 ${confirmDeleteId === rec.id ? 'bg-red-100 text-red-700 px-2' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'} rounded transition cursor-pointer text-xs font-semibold`}
                                title="削除"
                              >
                                <Trash2 size={15} /> {confirmDeleteId === rec.id && '確認'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200/70 rounded-lg font-medium cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
