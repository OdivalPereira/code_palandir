import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PainelShell } from './PainelShell';
import { AnalisadorPage } from './AnalisadorPage';
import { MolduraPergaminho } from './rpgTheme';

/* Carregamento síncrono dinâmico via Vite glob para desacoplamento de F3 e F4 */
const hojeModules = import.meta.glob<{
  HojePage?: React.ComponentType;
  default?: React.ComponentType;
}>('../painel/hoje/HojePage.tsx', { eager: true });

const projetosModules = import.meta.glob<{
  ProjetosPage?: React.ComponentType;
  default?: React.ComponentType;
}>('../painel/projetos/ProjetosPage.tsx', { eager: true });

const hojeMod =
  hojeModules['../painel/hoje/HojePage.tsx'] || Object.values(hojeModules)[0];
const HojeComponent = hojeMod?.HojePage || hojeMod?.default;

const projetosMod =
  projetosModules['../painel/projetos/ProjetosPage.tsx'] ||
  Object.values(projetosModules)[0];
const ProjetosComponent = projetosMod?.ProjetosPage || projetosMod?.default;

const HojePlaceholder: React.FC = () => (
  <MolduraPergaminho titulo="O Conselho" subtitulo="Visão geral e abertura">
    <div className="py-12 text-center" role="status">
      <p className="text-stone-300 font-serif text-lg">
        O Conselho está se reunindo em Valfenda...
      </p>
      <p className="text-stone-500 text-sm mt-2">
        Aguardando chegada dos pergaminhos (Fatia 3).
      </p>
    </div>
  </MolduraPergaminho>
);

const ProjetosPlaceholder: React.FC = () => (
  <MolduraPergaminho titulo="Regiões" subtitulo="Mapa de projetos e jornadas">
    <div className="py-12 text-center" role="status">
      <p className="text-stone-300 font-serif text-lg">
        Explorando os caminhos da Terra-média...
      </p>
      <p className="text-stone-500 text-sm mt-2">
        Mapeando fortalezas e acampamentos (Fatia 4).
      </p>
    </div>
  </MolduraPergaminho>
);

const HojeRoute: React.FC = () => {
  if (HojeComponent) {
    const Component = HojeComponent;
    return <Component />;
  }
  return <HojePlaceholder />;
};

const ProjetosRoute: React.FC = () => {
  if (ProjetosComponent) {
    const Component = ProjetosComponent;
    return <Component />;
  }
  return <ProjetosPlaceholder />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <PainelShell>
        <Routes>
          <Route path="/" element={<HojeRoute />} />
          <Route path="/projetos" element={<ProjetosRoute />} />
          <Route path="/projetos/:id" element={<ProjetosRoute />} />
          <Route path="/analisador" element={<AnalisadorPage />} />
        </Routes>
      </PainelShell>
    </BrowserRouter>
  );
};

export default App;
