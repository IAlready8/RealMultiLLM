/**
 * Compliance Status Indicator
 * Shows the current compliance status of the application
 */

import React from 'react';
import { Shield, ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface ComplianceStatusIndicatorProps {
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  hipaaCompliant?: boolean;
  soc2Compliant?: boolean;
  className?: string;
}

const ComplianceStatusIndicator: React.FC<ComplianceStatusIndicatorProps> = ({
  gdprCompliant,
  ccpaCompliant,
  hipaaCompliant,
  soc2Compliant,
  className = ''
}) => {
  // Calculate overall compliance status
  const getOverallStatus = () => {
    if (!gdprCompliant || !ccpaCompliant) {
      return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', text: 'Non-Compliant' };
    }
    
    const compliantStandards = [
      gdprCompliant ? 1 : 0,
      ccpaCompliant ? 1 : 0,
      hipaaCompliant ? 1 : 0,
      soc2Compliant ? 1 : 0
    ].filter(Boolean).length;
    
    if (compliantStandards >= 3) {
      return { icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10', text: 'High Compliance' };
    } else {
      return { icon: Shield, color: 'text-yellow-500', bg: 'bg-yellow-500/10', text: 'Partial Compliance' };
    }
  };

  const overall = getOverallStatus();
  const OverallIcon = overall.icon;

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`${overall.bg} p-2 rounded-full`}>
          <OverallIcon className={`h-5 w-5 ${overall.color}`} />
        </div>
        <div>
          <h4 className="font-medium text-gray-900">Compliance Status</h4>
          <p className={`text-sm ${overall.color}`}>{overall.text}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* GDPR Status */}
        <StatusCard 
          title="GDPR" 
          compliant={gdprCompliant} 
          tooltip="General Data Protection Regulation (EU)" 
        />
        
        {/* CCPA Status */}
        <StatusCard 
          title="CCPA" 
          compliant={ccpaCompliant} 
          tooltip="California Consumer Privacy Act" 
        />
        
        {/* HIPAA Status */}
        {hipaaCompliant !== undefined && (
          <StatusCard 
            title="HIPAA" 
            compliant={hipaaCompliant} 
            tooltip="Health Insurance Portability and Accountability Act" 
          />
        )}
        
        {/* SOC 2 Status */}
        {soc2Compliant !== undefined && (
          <StatusCard 
            title="SOC 2" 
            compliant={soc2Compliant} 
            tooltip="Service Organization Control 2" 
          />
        )}
      </div>
    </div>
  );
};

interface StatusCardProps {
  title: string;
  compliant: boolean;
  tooltip: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, compliant, tooltip }) => {
  const Icon = compliant ? CheckCircle : XCircle;
  const color = compliant ? 'text-green-500' : 'text-red-500';
  const bg = compliant ? 'bg-green-500/10' : 'bg-red-500/10';

  return (
    <div 
      className="flex flex-col items-center p-3 rounded-lg border"
      title={tooltip}
    >
      <div className={`${bg} p-1.5 rounded-full mb-1`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <span className="text-xs font-medium">{title}</span>
      <span className={`text-xs mt-1 ${compliant ? 'text-green-600' : 'text-red-600'}`}>
        {compliant ? 'Compliant' : 'Non-Compliant'}
      </span>
    </div>
  );
};

export default ComplianceStatusIndicator;