// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Ground Truth Evaluation Component
 *
 * This is the consolidated version of the GroundTruthEvaluation component.
 * The previous standalone version in /src/components/GroundTruthEvaluation.tsx
 * was a UI prototype that has been replaced by this fully functional implementation.
 */
import { CheckSquare, Upload, BarChart2, Database } from 'lucide-react';
import React, { useState } from 'react';

import ConfigureQBusiness from './ConfigureQBusiness';
import Evaluate from './Evaluate';
import ResultsTab from './ResultsTab';
import UploadDataComponent from './UploadDataComponent';

interface GroundTruthData {
  prompt: string;
  groundTruth: string;
}

interface EvaluationResult {
  prompt: string;
  groundTruth: string;
  response: string;
  status: 'pending' | 'completed' | 'error';
  error?: string;
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children, icon }) => {
  return (
    <button
      onClick={onClick}
      className={`py-4 px-4 border-b-2 transition-all flex items-center ${
        active
          ? 'border-purple-500 text-purple-400'
          : 'border-transparent text-gray-400 hover:text-white'
      }`}
    >
      {icon}
      {children}
    </button>
  );
};

const GroundTruthEvaluation: React.FC = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [fileName, setFileName] = useState<string>('');
  const [fileData, setFileData] = useState<GroundTruthData[]>([]);

  // Evaluation state
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([]);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [currentEvaluationIndex, setCurrentEvaluationIndex] = useState<number>(0);
  const [evaluationComplete, setEvaluationComplete] = useState<boolean>(false);

  // S3 bucket state - needed for the results tab
  const [s3BucketName, setS3BucketName] = useState<string>('');

  // Evaluation job state
  const [evaluationJobId, setEvaluationJobId] = useState<string>('');
  const [outputFolder, setOutputFolder] = useState<string>('');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 backdrop-blur-lg bg-gray-900/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          {/* Left section with padding for "Back to Tools" button */}
          <div className="flex items-center">
            {/* Space for the "Back to Tools" button */}
            <div className="w-36"></div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent ml-4">
              Ground Truth Evaluation
            </h1>
          </div>
          {/* Right section with space for Sign Out button */}
          <div className="w-28"></div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-6">
          <nav className="flex gap-6">
            <TabButton
              active={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
              icon={<Upload className="w-4 h-4 mr-2" />}
            >
              Upload Data
            </TabButton>
            <TabButton
              active={activeTab === 'configure'}
              onClick={() => setActiveTab('configure')}
              icon={<Database className="w-4 h-4 mr-2" />}
            >
              Configure QBusiness
            </TabButton>
            <TabButton
              active={activeTab === 'evaluate'}
              onClick={() => setActiveTab('evaluate')}
              icon={<CheckSquare className="w-4 h-4 mr-2" />}
            >
              Evaluate
            </TabButton>
            <TabButton
              active={activeTab === 'results'}
              onClick={() => setActiveTab('results')}
              icon={<BarChart2 className="w-4 h-4 mr-2" />}
            >
              Results
            </TabButton>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {activeTab === 'upload' && (
          <UploadDataComponent
            fileData={fileData}
            setFileData={setFileData}
            fileName={fileName}
            setFileName={setFileName}
            onContinue={() => setActiveTab('configure')}
          />
        )}

        {activeTab === 'configure' && (
          <ConfigureQBusiness
            fileData={fileData}
            evaluationResults={evaluationResults}
            setEvaluationResults={setEvaluationResults}
            isEvaluating={isEvaluating}
            setIsEvaluating={setIsEvaluating}
            currentEvaluationIndex={currentEvaluationIndex}
            setCurrentEvaluationIndex={setCurrentEvaluationIndex}
            evaluationComplete={evaluationComplete}
            setEvaluationComplete={setEvaluationComplete}
            onContinue={() => setActiveTab('evaluate')}
          />
        )}

        {activeTab === 'evaluate' && (
          <Evaluate
            evaluationResults={evaluationResults}
            isEvaluating={isEvaluating}
            currentEvaluationIndex={currentEvaluationIndex}
            evaluationComplete={evaluationComplete}
            fileData={fileData}
            onContinue={() => setActiveTab('results')}
            setEvaluationJobId={setEvaluationJobId}
            setOutputFolder={setOutputFolder}
            s3BucketName={s3BucketName}
            setS3BucketName={setS3BucketName}
          />
        )}

        {activeTab === 'results' && (
          <ResultsTab
            evaluationJobId={evaluationJobId}
            s3BucketName={s3BucketName}
            outputFolder={outputFolder}
          />
        )}
      </div>
    </div>
  );
};

export default GroundTruthEvaluation;
