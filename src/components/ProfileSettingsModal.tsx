import { useState, useEffect, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { SenderProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { UserCheck, Plus, Trash2, Edit3, CheckCircle2, Star, Building2, Briefcase, User, Sparkles } from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId?: string;
  onSelectProfile: (profile: SenderProfile) => void;
  userId: string;
}

const PRESET_PROFILE_NAMES = [
  { name: '会社用 (本業)', icon: Building2, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { name: '副業用', icon: Briefcase, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { name: '個人用 / 屋号', icon: User, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { name: 'プロジェクト用', icon: Sparkles, color: 'text-amber-700 bg-amber-50 border-amber-200' },
];

const INITIAL_FORM_DATA: Omit<SenderProfile, 'id' | 'userId'> = {
  profileName: '',
  senderCompany: '',
  senderRepresentative: '',
  senderAddress: '',
  senderPhone: '',
  senderEmail: '',
  bankDetails: '',
  remarks: '',
  isDefault: false,
};

export function ProfileSettingsModal({
  isOpen,
  onClose,
  activeProfileId,
  onSelectProfile,
  userId,
}: ProfileSettingsModalProps) {
  const [profiles, setProfiles] = useState<SenderProfile[]>([]);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<SenderProfile, 'id' | 'userId'>>(INITIAL_FORM_DATA);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Load profiles from Firestore
  useEffect(() => {
    if (!isOpen) return;

    const path = 'sender_profiles';
    const q = query(
      collection(db, 'sender_profiles'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SenderProfile[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SenderProfile, 'id'>),
        }));
        setProfiles(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleStartNew = () => {
    setEditingProfileId(null);
    setFormData({
      ...INITIAL_FORM_DATA,
      isDefault: profiles.length === 0,
    });
    setIsFormOpen(true);
    setStatusMsg(null);
  };

  const handleStartEdit = (profile: SenderProfile) => {
    setEditingProfileId(profile.id || null);
    setFormData({
      profileName: profile.profileName || '',
      senderCompany: profile.senderCompany || '',
      senderRepresentative: profile.senderRepresentative || '',
      senderAddress: profile.senderAddress || '',
      senderPhone: profile.senderPhone || '',
      senderEmail: profile.senderEmail || '',
      bankDetails: profile.bankDetails || '',
      remarks: profile.remarks || '',
      isDefault: !!profile.isDefault,
    });
    setIsFormOpen(true);
    setStatusMsg(null);
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingProfileId(null);
    setStatusMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.profileName.trim()) {
      setStatusMsg({ type: 'error', text: 'プロファイル名（例: 会社用、副業用など）を入力してください。' });
      return;
    }
    if (!formData.senderCompany.trim()) {
      setStatusMsg({ type: 'error', text: '自社名／屋号／氏名を入力してください。' });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);
    const now = new Date().toISOString();

    try {
      if (editingProfileId) {
        // Update existing profile
        const path = `sender_profiles/${editingProfileId}`;
        const ref = doc(db, 'sender_profiles', editingProfileId);
        await updateDoc(ref, {
          ...formData,
          profileName: formData.profileName.trim(),
          senderCompany: formData.senderCompany.trim(),
          senderRepresentative: formData.senderRepresentative.trim(),
          senderAddress: formData.senderAddress.trim(),
          senderPhone: formData.senderPhone.trim(),
          senderEmail: formData.senderEmail.trim(),
          bankDetails: formData.bankDetails.trim(),
          remarks: formData.remarks.trim(),
          userId,
          updatedAt: now,
        });

        // Also update legacy settings/profile if default
        if (formData.isDefault) {
          await setDoc(doc(db, 'settings', userId), {
            ...formData,
            userId,
            updatedAt: now,
          }, { merge: true });
        }

        setStatusMsg({ type: 'success', text: `「${formData.profileName}」を更新しました。` });
      } else {
        // Add new profile
        const path = 'sender_profiles';
        const docRef = await addDoc(collection(db, 'sender_profiles'), {
          ...formData,
          profileName: formData.profileName.trim(),
          senderCompany: formData.senderCompany.trim(),
          senderRepresentative: formData.senderRepresentative.trim(),
          senderAddress: formData.senderAddress.trim(),
          senderPhone: formData.senderPhone.trim(),
          senderEmail: formData.senderEmail.trim(),
          bankDetails: formData.bankDetails.trim(),
          remarks: formData.remarks.trim(),
          userId,
          createdAt: now,
          updatedAt: now,
        });

        // Also sync to legacy settings/profile if it's the first or default
        if (formData.isDefault || profiles.length === 0) {
          await setDoc(doc(db, 'settings', userId), {
            ...formData,
            userId,
            updatedAt: now,
          }, { merge: true });
        }

        setStatusMsg({ type: 'success', text: `自社プロファイル「${formData.profileName}」を登録しました！` });
      }

      setIsFormOpen(false);
      setEditingProfileId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sender_profiles');
      setStatusMsg({ type: 'error', text: '保存に失敗しました。ネットワーク状況をご確認ください。' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (profile: SenderProfile) => {
    if (!profile.id) return;
    
    const path = `sender_profiles/${profile.id}`;
    try {
      await deleteDoc(doc(db, 'sender_profiles', profile.id));
      setStatusMsg({ type: 'success', text: `「${profile.profileName}」を削除しました。` });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      setStatusMsg({ type: 'error', text: '削除に失敗しました。' });
    }
  };

  const handleSetDefault = async (profile: SenderProfile) => {
    if (!profile.id) return;
    try {
      // Set this one to default
      await updateDoc(doc(db, 'sender_profiles', profile.id), { isDefault: true });
      // Unset others
      for (const p of profiles) {
        if (p.id && p.id !== profile.id && p.isDefault) {
          await updateDoc(doc(db, 'sender_profiles', p.id), { isDefault: false });
        }
      }
      // Update legacy settings/profile
      await setDoc(doc(db, 'settings', userId), {
        senderCompany: profile.senderCompany,
        senderRepresentative: profile.senderRepresentative,
        senderAddress: profile.senderAddress,
        senderPhone: profile.senderPhone,
        senderEmail: profile.senderEmail,
        bankDetails: profile.bankDetails,
        remarks: profile.remarks,
        userId,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setStatusMsg({ type: 'success', text: `「${profile.profileName}」をデフォルト自社情報に設定しました。` });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sender_profiles/${profile.id}`);
      setStatusMsg({ type: 'error', text: 'デフォルト設定に失敗しました。' });
    }
  };

  const handleSelectAndApply = (profile: SenderProfile) => {
    onSelectProfile(profile);
    onClose();
  };

  return (
    <div id="personal-profile-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div id="personal-profile-modal" className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">複数自社（発行元）パーソナルデータ管理</h2>
              <p className="text-xs text-slate-500">
                会社用・副業用・個人用などを複数登録し、ワンクリックで請求書に切り替えられます
              </p>
            </div>
          </div>
          <button
            id="close-profile-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 text-lg font-bold cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl flex items-center justify-between text-xs font-semibold ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : null}
                <span>{statusMsg.text}</span>
              </div>
              <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">✕</button>
            </div>
          )}

          {/* Top action bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
            <div className="text-xs text-slate-600 font-medium">
              登録中の自社プロファイル: <span className="font-bold text-blue-700">{profiles.length} 件</span>
            </div>
            {!isFormOpen && (
              <button
                id="add-new-profile-btn"
                onClick={handleStartNew}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus size={14} /> 新しい自社プロファイルを追加
              </button>
            )}
          </div>

          {/* Form Section (New or Edit) */}
          {isFormOpen ? (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-5 rounded-2xl border border-blue-200 space-y-4 shadow-xs animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Edit3 size={16} className="text-blue-600" />
                  {editingProfileId ? '自社プロファイルを編集' : '新しい自社プロファイルを追加'}
                </h3>
                <span className="text-[11px] text-slate-500">Firebaseクラウドに自動保存されます</span>
              </div>

              {/* Profile Name & Quick Preset Chips */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1.5">
                  プロファイル名 / 用途区分 <span className="text-red-500">*</span>
                </label>
                <input
                  id="profile-name-input"
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none mb-2 font-medium"
                  placeholder="例: 株式会社〇〇（本業）、副業用、個人事業主（屋号）など"
                  value={formData.profileName}
                  onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
                />
                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 mr-1">ワンクリック入力:</span>
                  {PRESET_PROFILE_NAMES.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, profileName: preset.name })}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer hover:scale-105 active:scale-95 ${preset.color}`}
                      >
                        <Icon size={12} /> {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Company & Rep */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">
                    自社名 / 屋号 / 氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="profile-company-input"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例: 株式会社〇〇 / 田中商店 / 山田 太郎"
                    value={formData.senderCompany}
                    onChange={(e) => setFormData({ ...formData, senderCompany: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">
                    代表者名 / 担当者名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="profile-rep-input"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例: 代表取締役 山田 太郎 / 代表 田中 一郎"
                    value={formData.senderRepresentative}
                    onChange={(e) => setFormData({ ...formData, senderRepresentative: e.target.value })}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">
                  住所 <span className="text-red-500">*</span>
                </label>
                <input
                  id="profile-address-input"
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例: 東京都渋谷区〇〇 1-2-3 〇〇ビル4F"
                  value={formData.senderAddress}
                  onChange={(e) => setFormData({ ...formData, senderAddress: e.target.value })}
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">
                    電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="profile-phone-input"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例: 03-1234-5678"
                    value={formData.senderPhone}
                    onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="profile-email-input"
                    type="email"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例: invoice@example.com"
                    value={formData.senderEmail}
                    onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                  />
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">
                  振込先口座情報（このプロファイルの口座）
                </label>
                <textarea
                  id="profile-bank-input"
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  placeholder={"〇〇銀行 〇〇支店 普通 1234567\n口座名義: カ) カイシャメイ"}
                  value={formData.bankDetails}
                  onChange={(e) => setFormData({ ...formData, bankDetails: e.target.value })}
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">
                  備考 / インボイス登録番号（適格請求書登録番号など）
                </label>
                <textarea
                  id="profile-remarks-input"
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="登録番号: T1234567890123 / お振込手数料は貴社にてご負担願います。"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>

              {/* Default Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="profile-default-checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="profile-default-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  このプロファイルを新規作成時の初期選択（デフォルト）にする
                </label>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200/80 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isSaving ? '保存中...' : editingProfileId ? '更新して保存' : '登録して保存'}
                </button>
              </div>
            </form>
          ) : null}

          {/* Profiles List Cards */}
          <div className="space-y-3">
            {profiles.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Building2 size={36} className="mx-auto text-slate-400 mb-2" />
                <p className="font-bold text-slate-700 text-sm">自社プロファイルがまだ登録されていません</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  「会社用」「副業用」「個人用」などを登録しておくと、請求書作成時にワンタップで切り替えられます。
                </p>
                <button
                  onClick={handleStartNew}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer transition"
                >
                  <Plus size={14} /> 最初の自社プロファイルを登録
                </button>
              </div>
            ) : (
              profiles.map((p) => {
                const isActive = activeProfileId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border transition relative flex flex-col sm:flex-row justify-between sm:items-center gap-3 ${
                      isActive
                        ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-slate-900 text-sm">
                          {p.profileName}
                        </span>
                        {p.isDefault && (
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                            <Star size={10} className="fill-amber-600 text-amber-600" /> デフォルト
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            現在選択中
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 font-medium space-y-0.5">
                        <p className="font-semibold text-slate-800">
                          {p.senderCompany}
                          {p.senderRepresentative && <span className="text-slate-500 ml-2">({p.senderRepresentative})</span>}
                        </p>
                        <p className="text-slate-500 text-[11px] truncate">{p.senderAddress}</p>
                        <p className="text-slate-500 text-[11px]">
                          TEL: {p.senderPhone} / Email: {p.senderEmail}
                        </p>
                        {p.bankDetails && (
                          <p className="text-[11px] text-emerald-700 truncate font-mono">
                            🏦 口座: {p.bankDetails.split('\n')[0]}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-center shrink-0">
                      <button
                        id={`select-profile-${p.id}`}
                        onClick={() => handleSelectAndApply(p)}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                        title="このプロファイルを請求書に反映する"
                      >
                        <CheckCircle2 size={13} /> 請求書に反映
                      </button>

                      {!p.isDefault && (
                        <button
                          onClick={() => handleSetDefault(p)}
                          className="flex items-center gap-1 text-slate-600 hover:text-amber-800 hover:bg-amber-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                          title="次回以降の標準設定にする"
                        >
                          <Star size={12} /> 標準に設定
                        </button>
                      )}

                      <button
                        onClick={() => handleStartEdit(p)}
                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-xl transition cursor-pointer"
                        title="編集"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => {
                          if (confirmDeleteId === p.id) {
                            handleDelete(p);
                            setConfirmDeleteId(null);
                          } else {
                            if (p.id) {
                              setConfirmDeleteId(p.id);
                              setTimeout(() => setConfirmDeleteId(null), 3000);
                            }
                          }
                        }}
                        className={`flex items-center gap-1 p-1.5 ${confirmDeleteId === p.id ? 'bg-red-100 text-red-700 px-2' : 'text-slate-400 hover:text-red-700 hover:bg-red-50'} border border-slate-200 rounded-xl transition cursor-pointer text-xs font-semibold`}
                        title="削除"
                      >
                        <Trash2 size={14} /> {confirmDeleteId === p.id && '確認'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>※ 各自社データはFirebaseクラウド上に安全に保管・同期されます</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl font-semibold text-slate-700 cursor-pointer transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
