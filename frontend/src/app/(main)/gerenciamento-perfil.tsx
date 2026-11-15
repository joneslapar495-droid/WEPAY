import { useAppTheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";
/**
 * ============================================================
 * WEPAY - GERENCIAMENTO DE PERFIL
 * ============================================================
 *
 * Esta tela permite ao usuário:
 *
 * - visualizar seus dados;
 * - alterar nome;
 * - alterar e-mail;
 * - salvar alterações;
 * - acessar a alteração de senha;
 * - sair da conta.
 *
 *
 * IMPORTANTE
 * ------------------------------------------------------------
 *
 * Esta tela segue o mesmo padrão de programação utilizado
 * pelo projeto enviado no ZIP:
 *
 * - React + useState;
 * - componentes do React Native;
 * - TouchableOpacity;
 * - TextInput;
 * - Alert;
 * - ScrollView;
 * - StyleSheet;
 * - navegação com Expo Router.
 *
 *
 * Os dados do perfil são carregados e salvos pela API.
 */


/* ============================================================
   IMPORTS
============================================================ */

/**
 * React e useState:
 *
 * useState será utilizado para armazenar os dados
 * digitados pelo usuário.
 */
import React, { useState } from "react";


/**
 * Componentes básicos do React Native.
 */
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";


/**
 * SafeAreaView mantém o conteúdo dentro da área segura
 * do celular.
 */
import { SafeAreaView } from "react-native-safe-area-context";


/**
 * Expo Router permite navegar entre as telas.
 */
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useUsuario } from "@/contexts/UsuarioContext";
import { authApi } from "@/services/api";
import { Alert } from "@/services/feedback";


/**
 * ============================================================
 * COMPONENTE PRINCIPAL
============================================================ */

export default function GerenciamentoPerfilScreen() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const { usuario, atualizarPerfil, logout } = useUsuario();
  const usuarioAtual = usuario ?? {
    id: "",
    nome: "",
    email: "",
    telefone: "",
    pixChave: "",
    iniciais: "",
    saldoTotal: 0,
  };

  /**
   * ==========================================================
   * ESTADOS DO FORMULÁRIO
   ========================================================== */

  /**
   * Nome atual do usuário.
   */
  const [nome, setNome] = useState(usuarioAtual.nome);


  /**
   * E-mail do usuário.
   */
  const [email, setEmail] =
    useState(usuarioAtual.email);


  const [chavePix, setChavePix] =
    useState(usuarioAtual.pixChave ?? "");


  /**
   * Controla o estado de carregamento do botão
   * "Salvar alterações".
   */
  const [salvando, setSalvando] =
    useState(false);
  const [alterandoFoto, setAlterandoFoto] =
    useState(false);


  /**
   * ==========================================================
   * FUNÇÃO DE VALIDAÇÃO DE E-MAIL
   ========================================================== */

  /**
   * Verifica se o e-mail possui uma estrutura básica.
   */
  function emailValido(valor: string): boolean {

    return /\S+@\S+\.\S+/.test(valor);

  }

  async function selecionarFotoPerfil() {
    if (alterandoFoto) return;
    setAlterandoFoto(true);

    try {
      if (Platform.OS !== "web") {
        const permissao =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissao.granted) {
          Alert.alert(
            "Permissão necessária",
            "Permita o acesso às fotos para escolher uma imagem de perfil.",
          );
          return;
        }
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (resultado.canceled || !resultado.assets[0]) return;

      const imagemBase64 = resultado.assets[0].base64;
      if (!imagemBase64) {
        Alert.alert(
          "Foto inválida",
          "Não foi possível ler a imagem selecionada. Escolha outra foto.",
        );
        return;
      }

      try {
        const resposta = await authApi.atualizarAvatar(imagemBase64);
        atualizarPerfil({ avatarUrl: resposta.data.avatar_url });
      } catch {
        // A camada da API já exibe o erro de operações CRUD.
        return;
      }
    } catch (erro) {
      Alert.alert(
        "Foto não atualizada",
        erro instanceof Error
          ? erro.message
          : "Não foi possível salvar sua foto de perfil.",
      );
    } finally {
      setAlterandoFoto(false);
    }
  }


  /**
   * ==========================================================
   * FUNÇÃO DE SALVAR
   ========================================================== */

  async function salvarAlteracoes() {

    /**
     * Remove espaços desnecessários do nome.
     */
    const nomeLimpo = nome.trim();


    /**
     * Remove espaços desnecessários do e-mail.
     */
    const emailLimpo = email.trim();
    const chavePixLimpa = chavePix.trim();


    /**
     * ========================================================
     * VALIDAÇÃO DO NOME
     ======================================================== */

    if (!nomeLimpo) {

      Alert.alert(
        "Atenção",
        "Digite seu nome."
      );

      return;
    }


    /**
     * Evita nomes muito curtos.
     */
    if (nomeLimpo.length < 3) {

      Alert.alert(
        "Atenção",
        "O nome precisa ter pelo menos 3 caracteres."
      );

      return;
    }


    /**
     * ========================================================
     * VALIDAÇÃO DO E-MAIL
     ======================================================== */

    if (!emailLimpo) {

      Alert.alert(
        "Atenção",
        "Digite seu e-mail."
      );

      return;
    }


    /**
     * Verifica se o e-mail possui um formato válido.
     */
    if (!emailValido(emailLimpo)) {

      Alert.alert(
        "Atenção",
        "Digite um e-mail válido."
      );

      return;
    }

    if (chavePixLimpa.length > 77) {
      Alert.alert(
        "Chave Pix inválida",
        "A chave Pix deve ter no máximo 77 caracteres.",
      );
      return;
    }


    /**
     * ========================================================
     * PROCESSAMENTO
     ======================================================== */

    try {

      /**
       * Ativa o estado de carregamento.
       */
      setSalvando(true);


      await authApi.atualizarPerfil({
        nome: nomeLimpo,
        email: emailLimpo,
        telefone: usuarioAtual.telefone,
        pix_chave: chavePixLimpa || null,
      });
      atualizarPerfil({
        nome: nomeLimpo,
        email: emailLimpo,
        pixChave: chavePixLimpa,
      });


      /**
       * Mostra mensagem de sucesso.
       */
      Alert.alert(
        "Perfil atualizado",
        "Suas informações foram atualizadas com sucesso."
      );

    } catch {

      /**
       * Caso aconteça algum erro.
       */
      Alert.alert(
        "Erro",
        "Não foi possível atualizar seu perfil."
      );

    } finally {

      /**
       * O finally executa tanto em sucesso quanto em erro.
       *
       * Portanto, sempre removemos o estado de carregamento.
       */
      setSalvando(false);

    }

  }


  /**
   * ==========================================================
   * FUNÇÃO ALTERAR SENHA
   ========================================================== */

  function alterarSenha() {
    router.push("/(main)/alterar-senha");

  }


  /**
   * ==========================================================
   * FUNÇÃO SAIR
   ========================================================== */

  function sairDaConta() {

    /**
     * Antes de sair, pedimos confirmação ao usuário.
     *
     * O Alert possui dois botões:
     *
     * Cancelar
     * Sair
     */

    Alert.alert(
      "Sair da conta",
      "Tem certeza que deseja sair da sua conta?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },

        {
          text: "Sair",

          /**
           * Aqui ficará futuramente a remoção do token
           * armazenado no dispositivo.
           *
           * Exemplo futuro:
           *
           * await storage.removeToken();
           */

          onPress: async () => {
            try {
              await logout();
            } catch (erro) {
              Alert.alert(
                "Sessão encerrada",
                erro instanceof Error
                  ? erro.message
                  : "A sessão local foi encerrada, mas o servidor não confirmou a revogação.",
              );
            }
            router.replace("/(auth)/login");

          },
        },
      ]
    );

  }


  /**
   * ==========================================================
   * INTERFACE
   ========================================================== */

  return (

    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >

        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* =================================================
              CABEÇALHO
          ================================================== */}

          <View style={styles.header}>

            {/* -------------------------------------------------
                BOTÃO VOLTAR
            -------------------------------------------------- */}

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >

              <Text style={styles.backText}>
                ←
              </Text>

            </TouchableOpacity>


            {/* -------------------------------------------------
                TÍTULO
            -------------------------------------------------- */}

            <View style={styles.headerCenter}>

              <Text style={styles.headerTitle}>
                Meu perfil
              </Text>

              <Text style={styles.headerSubtitle}>
                Gerencie suas informações
              </Text>

            </View>


            {/*
              Espaço vazio do lado direito.
              Ele serve para manter o título centralizado.
            */}

            <View style={styles.headerSpace} />

          </View>

          {/* =================================================
              PERFIL / AVATAR
          ================================================== */}

          <View style={styles.profileHeader}>

            {/* -------------------------------------------------
                AVATAR
            -------------------------------------------------- */}

            <View style={styles.profileAvatar}>

              {usuarioAtual.avatarUrl ? (
                <Image
                  accessibilityLabel="Foto de perfil"
                  source={{ uri: usuarioAtual.avatarUrl }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <Text style={styles.profileAvatarText}>
                  {usuarioAtual.iniciais || "?"}
                </Text>
              )}

            </View>


            {/* -------------------------------------------------
                NOME
            -------------------------------------------------- */}

            <Text style={styles.profileName}>
              {nome || "Seu nome"}
            </Text>


            {/* -------------------------------------------------
                DESCRIÇÃO
            -------------------------------------------------- */}

            <Text style={styles.profileDescription}>
              Conta pessoal WEPAY
            </Text>


            {/* -------------------------------------------------
                BOTÃO AVATAR
            -------------------------------------------------- */}

            <TouchableOpacity
              style={[
                styles.photoButton,
                alterandoFoto && styles.photoButtonDisabled,
              ]}
              disabled={alterandoFoto}
              activeOpacity={0.7}
              onPress={() => void selecionarFotoPerfil()}
            >

              {alterandoFoto ? (
                <ActivityIndicator size="small" color={Cores.textoPositivo} />
              ) : (
                <Text style={styles.photoButtonText}>
                  {usuarioAtual.avatarUrl ? "Alterar foto" : "Adicionar foto"}
                </Text>
              )}

            </TouchableOpacity>

          </View>


          {/* =================================================
              SEÇÃO: INFORMAÇÕES PESSOAIS
          ================================================== */}

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>
              Informações pessoais
            </Text>


            {/* -------------------------------------------------
                NOME
            -------------------------------------------------- */}

            <View style={styles.field}>

              <Text style={styles.label}>
                Nome
              </Text>


              <TextInput
                style={styles.input}

                /**
                 * Valor atual do campo.
                 */
                value={nome}

                /**
                 * Atualiza o estado sempre que
                 * o usuário digitar.
                 */
                onChangeText={setNome}

                placeholder="Digite seu nome"
                placeholderTextColor={Cores.textoSuave}

                /**
                 * Como o nome é textual,
                 * utilizamos capitalização de palavras.
                 */
                autoCapitalize="words"

                autoCorrect={false}
              />

            </View>


            {/* -------------------------------------------------
                E-MAIL
            -------------------------------------------------- */}

            <View style={styles.field}>

              <Text style={styles.label}>
                E-mail
              </Text>


              <TextInput
                style={styles.input}

                value={email}

                onChangeText={setEmail}

                placeholder="seu@email.com"

                placeholderTextColor={Cores.textoSuave}

                /**
                 * Teclado apropriado para e-mail.
                 */
                keyboardType="email-address"

                /**
                 * Evita alteração automática para
                 * letras maiúsculas.
                 */
                autoCapitalize="none"

                autoCorrect={false}
              />

            </View>


            <View style={styles.field}>
              <Text style={styles.label}>Chave Pix para receber</Text>
              <TextInput
                style={styles.input}
                value={chavePix}
                onChangeText={setChavePix}
                placeholder="Digite sua chave Pix"
                placeholderTextColor={Cores.textoSuave}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={77}
              />
              <Text style={styles.helperText}>
                Opcional. Será mostrada apenas a quem deve a você em um grupo.
              </Text>
            </View>


            {/* =================================================
                BOTÃO SALVAR
            ================================================== */}

            <TouchableOpacity
              style={[
                styles.saveButton,

                /**
                 * Durante salvamento o botão fica
                 * visualmente mais discreto.
                 */
                salvando &&
                  styles.saveButtonDisabled,
              ]}

              /**
               * Evita executar novamente enquanto
               * uma operação estiver em andamento.
               */
              disabled={salvando}

              onPress={salvarAlteracoes}

              activeOpacity={0.8}
            >

              <Text style={styles.saveButtonText}>

                {salvando
                  ? "Salvando..."
                  : "Salvar alterações"}

              </Text>

            </TouchableOpacity>

          </View>


          {/* =================================================
              SEÇÃO: SEGURANÇA
          ================================================== */}

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>
              Segurança
            </Text>


            {/* -------------------------------------------------
                ALTERAR SENHA
            -------------------------------------------------- */}

            <TouchableOpacity
              style={styles.optionCard}
              onPress={alterarSenha}
              activeOpacity={0.7}
            >

              <View style={styles.optionIcon}>

                <Text style={styles.optionIconText}>
                  🔒
                </Text>

              </View>


              <View style={styles.optionContent}>

                <Text style={styles.optionTitle}>
                  Alterar senha
                </Text>

                <Text style={styles.optionDescription}>
                  Atualize a senha da sua conta
                </Text>

              </View>


              <Text style={styles.optionArrow}>
                ›
              </Text>

            </TouchableOpacity>

          </View>


          {/* =================================================
              SEÇÃO: CONTA
          ================================================== */}

          <View style={styles.section}>

            <Text style={styles.sectionTitle}>
              Conta
            </Text>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => router.push("/(main)/configuracoes")}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, { backgroundColor: Cores.principal }]}>
                <Text style={styles.optionIconText}>⚙️</Text>
              </View>

              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Configurações</Text>
                <Text style={styles.optionDescription}>
                  Notificações, tema e privacidade
                </Text>
              </View>

              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>


            {/* -------------------------------------------------
                SAIR
            -------------------------------------------------- */}

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={sairDaConta}
              activeOpacity={0.7}
            >

              <Text style={styles.logoutIcon}>
                ↪
              </Text>

              <Text style={styles.logoutText}>
                Sair da conta
              </Text>

            </TouchableOpacity>

          </View>


          {/* =================================================
              VERSÃO
          ================================================== */}

          <View style={styles.versionArea}>

            <Text style={styles.versionText}>
              WEPAY
            </Text>

            <Text style={styles.versionNumber}>
              Versão 1.0.0
            </Text>

          </View>

        </ScrollView>

      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}


/**
 * ============================================================
 * ESTILOS
 * ============================================================
 *
 * Os estilos seguem a mesma linguagem visual do projeto ZIP:
 *
 * Fundo:
 * #F5FBF7
 *
 * Tinta:
 * #0B3B33
 *
 * Verde:
 * #00C896
 *
 * Verde escuro:
 * #00A17A
 *
 * Texto suave:
 * #6B8F86
 *
 * Linha:
 * #E1EEE8
 *
 * Campo:
 * #F0F8F4
 */


/* ============================================================
   STYLE SHEET
============================================================ */

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({

  /* ==========================================================
     CONTAINER PRINCIPAL
  ========================================================== */

  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },


  keyboard: {
    flex: 1,
  },


  screen: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },


  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 45,
  },


  /* ==========================================================
     CABEÇALHO
  ========================================================== */

  header: {
    height: 65,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    marginBottom: 10,
  },


  backButton: {
    width: 42,
    height: 42,

    borderRadius: 12,

    backgroundColor: Cores.cartaoFundo,

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,
    borderColor: Cores.borda,
  },


  backText: {
    color: Cores.texto,

    fontSize: 28,

    fontWeight: "300",

    lineHeight: 32,
  },


  headerCenter: {
    flex: 1,

    alignItems: "center",

    paddingHorizontal: 10,
  },


  headerTitle: {
    fontSize: 18,

    fontWeight: "700",

    color: Cores.texto,
  },


  headerSubtitle: {
    marginTop: 2,

    fontSize: 10.5,

    color: Cores.textoSuave,
  },


  headerSpace: {
    width: 42,
  },


  /* ==========================================================
     CABEÇALHO DO PERFIL
  ========================================================== */

  profileHeader: {
    alignItems: "center",

    paddingTop: 12,

    paddingBottom: 24,
  },


  profileAvatar: {
    width: 84,
    height: 84,

    borderRadius: 28,

    backgroundColor: Cores.superficieMarca,

    justifyContent: "center",
    alignItems: "center",
  },


  profileAvatarText: {
    color: Cores.textoSobreMarca,

    fontSize: 24,

    fontWeight: "800",
  },

  profileAvatarImage: {
    width: 84,
    height: 84,
    borderRadius: 28,
  },


  profileName: {
    marginTop: 12,

    fontSize: 19,

    fontWeight: "700",

    color: Cores.texto,
  },


  profileDescription: {
    marginTop: 4,

    fontSize: 11,

    color: Cores.textoSuave,
  },


  photoButton: {
    marginTop: 10,

    paddingHorizontal: 14,
    paddingVertical: 7,

    borderRadius: 20,

    backgroundColor: Cores.fundoCampo,

    borderWidth: 1,
    borderColor: Cores.borda,
  },

  photoButtonDisabled: {
    opacity: 0.6,
  },


  photoButtonText: {
    fontSize: 11,

    fontWeight: "700",

    color: Cores.textoPositivo,
  },


  /* ==========================================================
     SEÇÕES
  ========================================================== */

  section: {
    marginTop: 8,

    marginBottom: 20,
  },


  sectionTitle: {
    marginBottom: 10,

    fontSize: 14,

    fontWeight: "700",

    color: Cores.texto,
  },


  /* ==========================================================
     CAMPOS
  ========================================================== */

  field: {
    marginBottom: 12,
  },


  label: {
    marginBottom: 6,

    fontSize: 11,

    fontWeight: "600",

    color: Cores.textoSuave,
  },

  helperText: {
    marginTop: 6,
    color: Cores.textoSuave,
    fontSize: 11,
    lineHeight: 16,
  },

  input: {
    minHeight: 50,

    paddingHorizontal: 13,

    borderRadius: 12,

    backgroundColor: Cores.fundoCampo,

    borderWidth: 1,
    borderColor: Cores.borda,

    fontSize: 13,

    color: Cores.texto,
  },


  /* ==========================================================
     BOTÃO SALVAR
  ========================================================== */

  saveButton: {
    minHeight: 50,

    marginTop: 6,

    borderRadius: 12,

    backgroundColor: Cores.principal,

    justifyContent: "center",
    alignItems: "center",
  },


  saveButtonDisabled: {
    opacity: 0.6,
  },


  saveButtonText: {
    fontSize: 13,

    fontWeight: "700",

    color: Cores.textoSobrePrincipal,
  },


  /* ==========================================================
     OPÇÕES
  ========================================================== */

  optionCard: {
    minHeight: 68,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 12,
    paddingVertical: 10,

    borderRadius: 14,

    backgroundColor: Cores.cartaoFundo,

    borderWidth: 1,
    borderColor: Cores.borda,
  },


  optionIcon: {
    width: 40,
    height: 40,

    borderRadius: 12,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: Cores.fundoCampo,
  },


  optionIconText: {
    fontSize: 18,
  },


  optionContent: {
    flex: 1,

    marginLeft: 10,
  },


  optionTitle: {
    fontSize: 12,

    fontWeight: "700",

    color: Cores.texto,
  },


  optionDescription: {
    marginTop: 3,

    fontSize: 10,

    color: Cores.textoSuave,
  },


  optionArrow: {
    marginLeft: 8,

    fontSize: 25,

    fontWeight: "300",

    color: Cores.textoSuave,
  },


  /* ==========================================================
     SAIR
  ========================================================== */

  logoutButton: {
    minHeight: 50,
    marginTop: 16,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    borderWidth: 1,

    borderColor: Cores.negativo,

    backgroundColor: Cores.superficieNegativa,
  },


  logoutIcon: {
    marginRight: 8,

    fontSize: 18,

    color: Cores.textoNegativo,
  },


  logoutText: {
    fontSize: 13,

    fontWeight: "700",

    color: Cores.textoNegativo,
  },


  /* ==========================================================
     VERSÃO
  ========================================================== */

  versionArea: {
    alignItems: "center",

    paddingTop: 5,

    paddingBottom: 10,
  },


  versionText: {
    fontSize: 10,

    fontWeight: "800",

    letterSpacing: 1.5,

    color: Cores.textoSuave,
  },


  versionNumber: {
    marginTop: 3,

    fontSize: 9,

    color: Cores.textoSuave,
  },
});
