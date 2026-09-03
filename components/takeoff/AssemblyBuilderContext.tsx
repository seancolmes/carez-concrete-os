'use client';

import { createContext, useContext } from 'react';

type AssemblyBuilderContextValue = {
  open: boolean;
  focus: boolean;
  openCreate: () => void;
  openLibrary: () => void;
  closeBuilder: () => void;
};

const AssemblyBuilderContext = createContext<AssemblyBuilderContextValue>({
  open: false,
  focus: false,
  openCreate: () => {},
  openLibrary: () => {},
  closeBuilder: () => {},
});

export const AssemblyBuilderProvider = AssemblyBuilderContext.Provider;
export const useAssemblyBuilderContext = () => useContext(AssemblyBuilderContext);
