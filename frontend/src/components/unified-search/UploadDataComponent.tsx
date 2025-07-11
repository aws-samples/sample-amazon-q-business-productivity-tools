// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Check, Upload, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import React, { useState, useRef } from 'react';

interface GroundTruthData {
  prompt: string;
  groundTruth: string;
}

interface UploadDataComponentProps {
  fileData: GroundTruthData[];
  setFileData: React.Dispatch<React.SetStateAction<GroundTruthData[]>>;
  fileName: string;
  setFileName: React.Dispatch<React.SetStateAction<string>>;
  onContinue: () => void;
}

const UploadDataComponent: React.FC<UploadDataComponentProps> = ({
  fileData,
  setFileData,
  fileName,
  setFileName,
  onContinue,
}) => {
  const [uploadError, setUploadError] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Process file data to extract prompt and groundTruth columns
  const processFileData = (data: any[]): GroundTruthData[] => {
    // Validate that the data has the required columns
    if (!data || data.length === 0) {
      setUploadError('File is empty or has no data');
      return [];
    }

    // Check if the first row has the required columns
    const firstRow = data[0];
    const hasPromptColumn = 'prompt' in firstRow;
    const hasGroundTruthColumn = 'groundTruth' in firstRow;

    if (!hasPromptColumn || !hasGroundTruthColumn) {
      setUploadError('File must contain "prompt" and "groundTruth" columns');
      return [];
    }

    // Map the data to the required format
    return data
      .map((row) => ({
        prompt: row.prompt || '',
        groundTruth: row.groundTruth || '',
      }))
      .filter((row) => row.prompt.trim() !== '');
  };

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setIsUploading(true);

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit');
      setIsUploading(false);
      return;
    }

    // Process based on file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      // Parse CSV file
      Papa.parse<any>(file, {
        header: true,
        complete: (results: Papa.ParseResult<any>) => {
          try {
            const processedData = processFileData(results.data);
            setFileData(processedData);
            setFileName(file.name);
            setIsUploading(false);
          } catch (error) {
            console.error('Error processing CSV:', error);
            setUploadError('Failed to process CSV file');
            setIsUploading(false);
          }
        },
        error: (error: Error) => {
          console.error('Error parsing CSV:', error);
          setUploadError('Failed to parse CSV file');
          setIsUploading(false);
        },
      });
    } else {
      setUploadError('Unsupported file format. Please upload CSV or Excel file.');
      setIsUploading(false);
    }
  };

  // Handle file drop
  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    // Update the file input value
    if (fileInputRef.current) {
      // Create a DataTransfer object to set the files property
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;

      // Trigger the onChange event handler
      const changeEvent = new Event('change', { bubbles: true });
      fileInputRef.current.dispatchEvent(changeEvent);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800">
        <h2 className="text-xl font-semibold mb-6 text-gray-200">Upload Ground Truth Dataset</h2>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Upload File</label>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <div
            className={`border-2 border-dashed ${uploadError ? 'border-red-500' : fileName ? 'border-green-500' : 'border-gray-700'} rounded-xl p-8 text-center hover:border-purple-500/50 transition-all cursor-pointer`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={handleFileDrop}
          >
            {fileName ? (
              <>
                <Check className="h-10 w-10 text-green-500 mx-auto mb-4" />
                <p className="text-green-400 mb-2">File uploaded successfully</p>
                <p className="text-gray-300 font-medium">{fileName}</p>
                <p className="text-gray-400 text-sm mt-2">{fileData.length} records loaded</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">Drag and drop your CSV or Excel file here</p>
                <p className="text-gray-500 text-sm">or</p>
                <button className="mt-4 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all">
                  Browse Files
                </button>
                <div className="mt-4 text-gray-600 text-xs">
                  <p className="mb-2">Supported formats: CSV, XLSX, XLS (max 10MB)</p>
                  <p className="mt-2">
                    Need a template? Download:
                    <a
                      href="/ground-truth-template.csv"
                      download
                      className="text-purple-400 hover:text-purple-300 ml-1"
                    >
                      CSV
                    </a>{' '}
                    |
                    <a
                      href="/ground-truth-template.xlsx"
                      download
                      className="text-purple-400 hover:text-purple-300 ml-1"
                    >
                      Excel
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>
          {uploadError && (
            <div className="mt-2 flex items-center text-red-500">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">{uploadError}</span>
            </div>
          )}

          {fileData.length > 0 && (
            <div className="mt-6 bg-gray-900/30 backdrop-blur-sm p-4 rounded-xl border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Preview</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">#</th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">
                        Prompt
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">
                        Ground Truth
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-b border-gray-800">
                        <td className="py-2 px-3 text-gray-400">{index + 1}</td>
                        <td className="py-2 px-3 text-gray-300">{truncateText(row.prompt, 50)}</td>
                        <td className="py-2 px-3 text-gray-300">
                          {truncateText(row.groundTruth, 50)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fileData.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2 text-right">
                    Showing 5 of {fileData.length} records
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            className={`px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-medium transition-all ${
              !fileData.length || isUploading
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:from-purple-600 hover:to-blue-600'
            }`}
            disabled={!fileData.length || isUploading}
            onClick={onContinue}
          >
            {isUploading ? 'Uploading...' : 'Continue to Configure QBusiness'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadDataComponent;
