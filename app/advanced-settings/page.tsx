import AdvancedSettings from '@/components/advanced-settings';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advanced Settings | RealMultiLLM',
  description: 'Customize your RealMultiLLM experience with advanced configuration options'
};

export default function AdvancedSettingsPage() {
  return <AdvancedSettings />;
}