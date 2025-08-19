import {
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
	SearchOutlined,
} from '@ant-design/icons'
import type {
	ActionType,
	ProColumns,
	RequestData,
} from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import type { InputRef } from 'antd'
import {
	Button,
	DatePicker,
	Empty,
	Form,
	Input,
	InputNumber,
	Modal,
	Tag,
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { debounce, toLower, trim } from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'

type RowItem = {
	key: string
	name: string
	date: string
	value: number
}

type FormValues = {
	name: string
	date: Dayjs
	value: number
}

const initialData: RowItem[] = []

function App() {
	const STORAGE_KEY = 'table-data-v1'
	const [data, setData] = useState<RowItem[]>(() => {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return initialData
		try {
			const parsed = JSON.parse(raw) as RowItem[]
			return Array.isArray(parsed) ? parsed : initialData
		} catch {
			return initialData
		}
	})
	const [search, setSearch] = useState('')
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [editingKey, setEditingKey] = useState<string | null>(null)
	const [deletingKey, setDeletingKey] = useState<string | null>(null)
	const [form] = Form.useForm<FormValues>()
	const inputRef = useRef<InputRef>(null)
	const actionRef = useRef<ActionType>(null)
	const [pageSize, setPageSize] = useState(10)

	useEffect(() => {
		const apply = () => {
			const w = window.innerWidth
			if (w <= 400) return setPageSize(3)
			if (w <= 480) return setPageSize(4)
			if (w <= 768) return setPageSize(6)
			setPageSize(10)
		}
		apply()
		window.addEventListener('resize', apply)
		return () => window.removeEventListener('resize', apply)
	}, [])

	useEffect(() => {
		const serialized = (() => {
			try {
				return JSON.stringify(data)
			} catch {
				return null
			}
		})()
		if (serialized !== null) localStorage.setItem(STORAGE_KEY, serialized)
	}, [data])

	const normalizedSearch = useMemo(() => toLower(trim(search)), [search])

	const openAdd = () => {
		setEditingKey(null)
		form.resetFields()
		setIsModalOpen(true)
		setTimeout(() => inputRef.current?.focus(), 0)
	}

	const openEdit = (record: RowItem) => {
		setEditingKey(record.key)
		form.setFieldsValue({
			name: record.name,
			date: dayjs(record.date, 'YYYY-MM-DD'),
			value: record.value,
		})
		setIsModalOpen(true)
		setTimeout(() => inputRef.current?.focus(), 0)
	}

	const handleDelete = async (key: string) => {
		setDeletingKey(key)
		await new Promise(r => setTimeout(r, 400))
		setData(prev => prev.filter(r => r.key !== key))
		setDeletingKey(null)
		actionRef.current?.reload()
	}

	const handleSubmit = async () => {
		const values = await form.validateFields()
		const item: RowItem = {
			key: editingKey ?? crypto.randomUUID(),
			name: values.name,
			date: values.date.format('YYYY-MM-DD'),
			value: values.value,
		}
		setData(prev => {
			if (editingKey) return prev.map(r => (r.key === editingKey ? item : r))
			return [item, ...prev]
		})
		setIsModalOpen(false)
		setEditingKey(null)
		form.resetFields()
		actionRef.current?.reload()
	}

	const columns: ProColumns<RowItem>[] = [
		{
			title: 'Имя',
			dataIndex: 'name',
			sorter: true,
			renderText: (text: string) => text,
			render: (_, record) => <Tag color='blue'>{record.name}</Tag>,
		},
		{
			title: 'Дата',
			dataIndex: 'date',
			valueType: 'date',
			sorter: true,
		},
		{
			title: 'Значение',
			dataIndex: 'value',
			valueType: 'digit',
			sorter: true,
			render: (_, record) => (
				<span>{new Intl.NumberFormat('ru-RU').format(record.value)}</span>
			),
		},
		{
			title: 'Действия',
			valueType: 'option',
			key: 'actions',
			render: (_, record) => [
				<Button
					key='edit'
					type='text'
					icon={<EditOutlined />}
					onClick={() => openEdit(record)}
					disabled={deletingKey === record.key}
				/>,
				<Button
					key='delete'
					danger
					type='text'
					icon={<DeleteOutlined />}
					onClick={() => handleDelete(record.key)}
					loading={deletingKey === record.key}
				/>,
			],
		},
	]

	const debouncedSetSearch = useMemo(
		() => debounce((v: string) => setSearch(v), 200),
		[]
	)

	return (
		<div className='page'>
			<div className='app-container'>
				<ProTable<RowItem>
					rowKey='key'
					columns={columns}
					search={false}
					options={false}
					actionRef={actionRef}
					params={{ keyword: normalizedSearch }}
					request={async (params, sorter) => {
						await new Promise(r => setTimeout(r, 300))
						const { current = 1, pageSize: ps = pageSize } = params as {
							current?: number
							pageSize?: number
							keyword?: string
						}
						const keyword = (params as { keyword?: string }).keyword || ''
						const norm = keyword ? toLower(trim(keyword)) : ''
						let rows = data.filter(row => {
							if (!norm) return true
							const cells: Array<string | number> = [
								row.name,
								row.date,
								row.value,
							]
							return cells.some(c =>
								typeof c === 'string'
									? toLower(c).includes(norm)
									: String(c).includes(norm)
							)
						})
						const sortEntries = Object.entries(sorter || {}) as Array<
							[keyof RowItem, 'ascend' | 'descend']
						>
						if (sortEntries.length) {
							const [field, order] = sortEntries[0]
							rows = [...rows].sort((a, b) => {
								const dir = order === 'ascend' ? 1 : -1
								if (field === 'name') return dir * a.name.localeCompare(b.name)
								if (field === 'date')
									return (
										dir * (dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
									)
								if (field === 'value') return dir * (a.value - b.value)
								return 0
							})
						}
						const total = rows.length
						const start = (current - 1) * ps
						const pageData = rows.slice(start, start + ps)
						return {
							data: pageData,
							success: true,
							total,
						} as RequestData<RowItem>
					}}
					pagination={{
						pageSize: 5,
						showSizeChanger: false,
						position: ['bottomCenter'],
					}}
					locale={{
						emptyText: (
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description='Нет данных'
							/>
						),
					}}
					toolBarRender={() => [
						<Button
							key='add'
							type='primary'
							icon={<PlusOutlined />}
							onClick={openAdd}
						>
							Добавить
						</Button>,
						<Input
							key='search'
							allowClear
							prefix={<SearchOutlined />}
							placeholder='Поиск по таблице'
							onChange={e => debouncedSetSearch(e.target.value)}
							className='toolbar-search'
						/>,
					]}
				/>

				<Modal
					open={isModalOpen}
					title={editingKey ? 'Редактировать запись' : 'Добавить запись'}
					onCancel={() => {
						setIsModalOpen(false)
						setEditingKey(null)
						form.resetFields()
					}}
					onOk={handleSubmit}
					okText={editingKey ? 'Сохранить' : 'Добавить'}
					cancelText='Отмена'
				>
					<Form form={form} layout='vertical'>
						<Form.Item
							name='name'
							label='Имя'
							rules={[{ required: true, message: 'Введите имя' }]}
							style={{ width: '60%' }}
						>
							<Input ref={inputRef} maxLength={64} placeholder='Имя' />
						</Form.Item>
						<Form.Item
							name='date'
							label='Дата'
							rules={[{ required: true, message: 'Выберите дату' }]}
						>
							<DatePicker style={{ width: '60%' }} format='YYYY-MM-DD' />
						</Form.Item>
						<Form.Item
							name='value'
							label='Значение'
							rules={[{ required: true, message: 'Введите число' }]}
						>
							<InputNumber
								min={-1_000_000_000}
								max={1_000_000_000}
								placeholder='Число'
								style={{ width: '60%' }}
							/>
						</Form.Item>
					</Form>
				</Modal>
			</div>
		</div>
	)
}

export default App
