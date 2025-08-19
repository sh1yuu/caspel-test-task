import { ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import ruRU from 'antd/locale/ru_RU'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/app.scss'

dayjs.locale('ru')

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<ConfigProvider locale={ruRU}>
			<App />
		</ConfigProvider>
	</StrictMode>
)
