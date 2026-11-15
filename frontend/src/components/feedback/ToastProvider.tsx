import { useEffect, useState, type PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  subscribeFeedback,
  type FeedbackNotification,
} from "@/services/feedback";

const DURACOES: Record<FeedbackNotification["type"], number> = {
  success: 3500,
  error: 7000,
  warning: 5500,
  info: 4500,
};

const ICONES: Record<FeedbackNotification["type"], string> = {
  success: "✓",
  error: "!",
  warning: "!",
  info: "i",
};

export function ToastProvider({ children }: PropsWithChildren) {
  const coresTema = useAppTheme();
  const styles = criarEstilos(coresTema);
  const [aviso, setAviso] = useState<FeedbackNotification | null>(null);

  useEffect(() => subscribeFeedback(setAviso), []);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), DURACOES[aviso.type]);
    return () => clearTimeout(timer);
  }, [aviso]);

  const cores = aviso
    ? {
        success: {
          fundo: coresTema.fundoToastSucesso,
          borda: coresTema.principalEscuro,
          icone: coresTema.textoPositivoSuave,
        },
        error: {
          fundo: coresTema.fundoToastErro,
          borda: coresTema.bordaErroFormulario,
          icone: coresTema.textoErroPrincipal,
        },
        warning: {
          fundo: coresTema.superficieAviso,
          borda: coresTema.bordaAviso,
          icone: coresTema.textoAvisoForte,
        },
        info: {
          fundo: coresTema.fundoToastInfo,
          borda: coresTema.texto,
          icone: coresTema.texto,
        },
      }[aviso.type]
    : null;

  return (
    <View style={styles.root}>
      {children}
      {aviso && cores ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          pointerEvents="box-none"
          style={styles.overlay}
        >
          <View style={[styles.toast, { backgroundColor: cores.fundo, borderLeftColor: cores.borda }]}>
            <View style={[styles.icon, { backgroundColor: cores.borda }]}>
              <Text style={[styles.iconText, { color: coresTema.textoSobreMarca }]}>{ICONES[aviso.type]}</Text>
            </View>
            <View style={styles.content}>
              <Text style={[styles.title, { color: cores.icone }]}>{aviso.title}</Text>
              {aviso.message ? (
                <Text style={[styles.message, { color: coresTema.textoToast }]}>{aviso.message}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Fechar aviso"
              hitSlop={8}
              onPress={() => setAviso(null)}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: coresTema.fecharToast }]}>×</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const criarEstilos = (cores: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10000,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  toast: {
    width: "100%",
    maxWidth: 520,
    minHeight: 64,
    borderLeftWidth: 5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 8,
    shadowColor: cores.tinta,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  iconText: { fontSize: 16, fontWeight: "800" },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: "800" },
  message: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  closeButton: { paddingLeft: 10, paddingVertical: 3 },
  closeText: { fontSize: 23, lineHeight: 24 },
});
