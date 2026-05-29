import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ConnectionProfile, ConnectionProfileInput, S3Provider } from '../../shared/types';
import { providerDefaults } from '../../shared/types';
import { useAppStore } from '../stores/app-store';

interface Props {
  open: boolean;
  profile?: ConnectionProfile;
  onClose: () => void;
}

const providers: Array<{ value: S3Provider; label: string }> = [
  { value: 'aws', label: 'AWS S3' },
  { value: 'cloudflare-r2', label: 'Cloudflare R2' },
  { value: 'minio', label: 'MinIO' },
  { value: 'wasabi', label: 'Wasabi' },
  { value: 'digitalocean-spaces', label: 'DigitalOcean Spaces' },
  { value: 'custom', label: 'Custom S3 API' }
];

const emptyForm = (provider: S3Provider): ConnectionProfileInput & { id?: string } => {
  const defaults = providerDefaults[provider];
  return {
    name: '',
    provider,
    accessKeyId: '',
    secretAccessKey: '',
    region: defaults.region,
    endpoint: defaults.endpoint,
    bucket: '',
    forcePathStyle: defaults.forcePathStyle
  };
};

export const ConnectionDialog = ({ open, profile, onClose }: Props): JSX.Element | null => {
  const saveProfile = useAppStore((state) => state.saveProfile);
  const toast = useAppStore((state) => state.toast);
  const [provider, setProvider] = useState<S3Provider>(profile?.provider ?? 'aws');
  const [form, setForm] = useState<ConnectionProfileInput & { id?: string }>(profile ?? emptyForm('aws'));

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextProvider = profile?.provider ?? 'aws';
    setProvider(nextProvider);
    setForm(profile ?? emptyForm(nextProvider));
  }, [open, profile]);

  if (!open) {
    return null;
  }

  const updateProvider = (next: S3Provider): void => {
    const nextDefaults = providerDefaults[next];
    setProvider(next);
    setForm((current) => ({
      ...current,
      provider: next,
      region: nextDefaults.region,
      endpoint: nextDefaults.endpoint,
      forcePathStyle: nextDefaults.forcePathStyle
    }));
  };

  const submit = async (): Promise<void> => {
    try {
      await saveProfile(form);
      onClose();
    } catch (error) {
      toast('error', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold">{form.id ? 'Edit Connection' : 'Connection Profile'}</h2>
          <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Name</span>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Provider</span>
            <select className="input" value={provider} onChange={(event) => updateProvider(event.target.value as S3Provider)}>
              {providers.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span>Access Key</span>
            <input className="input" value={form.accessKeyId} onChange={(event) => setForm({ ...form, accessKeyId: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Secret Key</span>
            <input className="input" type="password" value={form.secretAccessKey} onChange={(event) => setForm({ ...form, secretAccessKey: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Region</span>
            <input className="input" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Bucket</span>
            <input className="input" value={form.bucket ?? ''} onChange={(event) => setForm({ ...form, bucket: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span>Endpoint URL</span>
            <input className="input" value={form.endpoint ?? ''} onChange={(event) => setForm({ ...form, endpoint: event.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.forcePathStyle} onChange={(event) => setForm({ ...form, forcePathStyle: event.target.checked })} />
            Path-style requests
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button className="button-secondary" onClick={onClose}>Cancel</button>
          <button className="button-primary" onClick={() => void submit()}>{form.id ? 'Save Changes' : 'Save and Connect'}</button>
        </div>
      </div>
    </div>
  );
};
