import { api } from './client'
import type { AggregateRow, FileRecord, GeometryMesh, ModelSummary, QuantityRecord, TreeNode, UploadResponse } from './types'

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<UploadResponse>('/upload', form, {
    onUploadProgress(e) {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return data
}

export async function getSummary(fileId: string): Promise<ModelSummary> {
  const { data } = await api.get<ModelSummary>(`/files/${fileId}/summary`)
  return data
}

export async function getQuantities(
  fileId: string,
  params?: { ifc_type?: string; storey?: string; external_only?: boolean }
): Promise<QuantityRecord[]> {
  const { data } = await api.get<QuantityRecord[]>(`/files/${fileId}/quantities`, {
    params,
  })
  return data
}

export async function getAggregates(
  fileId: string,
  groupBy: 'ifc_type' | 'storey' = 'ifc_type'
): Promise<AggregateRow[]> {
  const { data } = await api.get<AggregateRow[]>(`/files/${fileId}/aggregates`, {
    params: { group_by: groupBy },
  })
  return data
}

export async function getElement(fileId: string, guid: string): Promise<QuantityRecord> {
  const { data } = await api.get<QuantityRecord>(`/files/${fileId}/elements/${guid}`)
  return data
}

export async function getTree(fileId: string): Promise<TreeNode> {
  const { data } = await api.get<TreeNode>(`/files/${fileId}/tree`)
  return data
}

export async function getGeometry(fileId: string): Promise<GeometryMesh[]> {
  const { data } = await api.get<GeometryMesh[]>(`/files/${fileId}/geometry`)
  return data
}

export async function getFiles(): Promise<FileRecord[]> {
  const { data } = await api.get<FileRecord[]>('/files')
  return data
}

export async function deleteFile(fileId: string): Promise<void> {
  await api.delete(`/files/${fileId}`)
}

export function csvUrl(fileId: string): string {
  return `/api/files/${fileId}/export/csv`
}

export function xlsxUrl(fileId: string): string {
  return `/api/files/${fileId}/export/xlsx`
}
