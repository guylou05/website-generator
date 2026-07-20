import { PageHeader } from '@/components/dashboard/page-header';
import { Bell, CreditCard, KeyRound, UserRound } from 'lucide-react';
const tabs = [
  ['Profile', UserRound],
  ['Notifications', Bell],
  ['API & integrations', KeyRound],
  ['Billing', CreditCard],
] as const;
export default function Settings() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and workspace preferences."
      />
      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.map(([name, Icon], i) => (
            <button className={i === 0 ? 'active' : ''} key={name}>
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>
        <section className="card settings-card">
          <div className="settings-heading">
            <h2>Profile</h2>
            <p>Update your personal information and public profile.</p>
          </div>
          <div className="profile-row">
            <div className="avatar avatar-large">AL</div>
            <div>
              <button className="button button-secondary">Change photo</button>
              <p>JPG, GIF or PNG. 2MB maximum.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              First name
              <input defaultValue="Alex" />
            </label>
            <label>
              Last name
              <input defaultValue="Lee" />
            </label>
            <label className="full-field">
              Email address
              <input defaultValue="alex@northstar.design" type="email" />
            </label>
            <label className="full-field">
              Role
              <input defaultValue="Creative Director" />
            </label>
          </div>
          <div className="settings-save">
            <button className="button button-primary">Save changes</button>
          </div>
        </section>
      </div>
    </>
  );
}
