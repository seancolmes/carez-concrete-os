'use client';

import { createContext, useContext } from 'react';

type AssemblyBuilderContextValue = {
  open: boolean;
  focus: boolean;
  openCreate: () => void;
  openLibrary: () => void;
  closeBuilder: () => void;
};

const DEFAULT_ASSEMBLY_BUILDER_CONTEXT: AssemblyBuilderContextValue = {
  open: false,
  focus: false,
  openCreate: () => {},
  openLibrary: () => {},
  closeBuilder: () => {},
};

const AssemblyBuilderContext = createContext<AssemblyBuilderContextValue>(DEFAULT_ASSEMBLY_BUILDER_CONTEXT);

export const AssemblyBuilderProvider = AssemblyBuilderContext.Provider;
export const useAssemblyBuilderContext = () => {
  const value = useContext(AssemblyBuilderContext);
  return { ...value, available: value !== DEFAULT_ASSEMBLY_BUILDER_CONTEXT };
};
