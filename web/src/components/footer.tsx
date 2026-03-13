import React from 'react'
import { $talc } from '../styles/utils'
import styled from '@emotion/styled'
import { Var, ThemeVar } from '../styles/variable'
import { useLanguage } from '../contexts/LanguageContext'

const FooterContainer = styled.div`
  ${$talc}
  color: ${Var(ThemeVar.FooterColor)};
  padding-top: 24px;
`

export function Footer() {
  const { t } = useLanguage()
  
  return (
    <FooterContainer>
      {t('footer')}
    </FooterContainer>
  )
}
