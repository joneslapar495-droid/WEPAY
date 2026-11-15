import { useAppTheme, useAppThemeScheme } from "@/hooks/useAppTheme";
import type { PaletaSemantica } from "@/constants/Cores";

/**
 * WEPAY — NOVA DESPESA EM GRUPO
 *
 * Mesmo padrão visual de nova-despesa-pessoal.tsx,
 * com campos específicos para despesas compartilhadas.
 *
 * Os participantes são carregados da API do grupo.
 */

import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { despesasGrupoApi, participantesApi } from "@/services/api";
import { Alert } from "@/services/feedback";
import {
  formatDateForInput,
  normalizeDateInput,
  parseCurrencyInput,
  parseDateInputToDate,
  parseDateInputToIso,
} from "@/utils/financeInput";
import { formatCurrencyBRL } from "@/utils/financeFormat";
import { CATEGORIAS_GRUPO as CATEGORIAS } from "@/constants/financeCategories";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";

type TipoDivisao = "IGUAL" | "VALOR" | "PERCENTUAL";

type Participante = {
  id: string;
  nome: string;
  iniciais: string;
};

function obterParametro(
  parametro: string | string[] | undefined
): string {
  if (Array.isArray(parametro)) {
    return parametro[0] ?? "";
  }

  return parametro ?? "";
}

export default function NovaDespesaGrupo() {
  const Cores = useAppTheme();
  const styles = createStyles(Cores);
  const esquema = useAppThemeScheme();
  const params = useLocalSearchParams();
  const { categorias, erro: erroCategorias } = useCategoriasFinanceiras("grupo", CATEGORIAS);

  const groupId = obterParametro(params.groupId);
  const nomeGrupo =
    obterParametro(params.grupoNome) || "Despesa compartilhada";

  // Dados básicos da despesa.
  const [descricao, setDescricao] = useState(() =>
    obterParametro(params.descricao)
  );

  const [valor, setValor] = useState(() =>
    obterParametro(params.valor)
  );

  const [data, setData] = useState(() =>
    normalizeDateInput(obterParametro(params.data))
  );

  const [categoria, setCategoria] = useState(() => {
    const categoriaRecebida = obterParametro(params.categoria);

    return categorias.some(
      (item) => item.nome === categoriaRecebida
    )
      ? categoriaRecebida
      : "Alimentação";
  });

  const [observacao, setObservacao] = useState("");

  // Dados específicos do grupo.
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [pagadorId, setPagadorId] = useState("");

  const [participantesSelecionados, setParticipantesSelecionados] =
    useState<string[]>([]);

  const [tipoDivisao, setTipoDivisao] =
    useState<TipoDivisao>("IGUAL");

  const [valoresIndividuais, setValoresIndividuais] =
    useState<Record<string, string>>({});

  const [percentuaisIndividuais, setPercentuaisIndividuais] =
    useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [mostrarSeletorData, setMostrarSeletorData] = useState(false);

  const descricaoLimpa = descricao.trim();
  const valorNumerico = parseCurrencyInput(valor);
  const dataLimpa = data.trim();

  function selecionarData(_evento: DateTimePickerEvent, dataSelecionada?: Date) {
    setMostrarSeletorData(false);
    if (dataSelecionada) setData(formatDateForInput(dataSelecionada));
  }

  useEffect(() => {
    if (!groupId || !Number.isInteger(Number(groupId))) return;
    let ativo = true;
    participantesApi.listarTodos(Number(groupId)).then((data) => {
      if (!ativo) return;
      const lista = data.filter((item) => item.ativo).map((item) => ({
        id: String(item.usuario_id),
        nome: item.nome || item.email || `Participante ${item.usuario_id}`,
        iniciais: (item.nome || item.email || "?").split(" ").slice(0, 2).map((nome) => nome[0]).join("").toUpperCase(),
      }));
      setParticipantes(lista);
      setParticipantesSelecionados(lista.map((item) => item.id));
      setPagadorId((atual) => atual || lista[0]?.id || "");
    }).catch((erro) => Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível carregar os participantes."));
    return () => { ativo = false; };
  }, [groupId]);

  // Atualiza o formulário caso o leitor de recibo devolva os dados
  // pelos parâmetros da rota.
  function voltarParaTelaAnterior() {
    router.back();
  }

  function lerRecibo() {
    router.push({
      pathname: "/(main)/receipt-reader/ler-recibo",
      params: {
        origem: "grupo",
        modo: "criar",
        groupId,
        grupoNome: nomeGrupo,
      },
    });
  }

  function alternarParticipante(id: string) {
    setParticipantesSelecionados((atuais) => {
      if (atuais.includes(id)) {
        return atuais.filter((item) => item !== id);
      }

      return [...atuais, id];
    });
  }

  function distribuirIgualmente(
    valorTotal: number,
    quantidade: number
  ): number[] {
    if (quantidade <= 0) {
      return [];
    }

    const totalCentavos = Math.round(valorTotal * 100);
    const valorBase = Math.floor(totalCentavos / quantidade);
    const resto = totalCentavos % quantidade;

    return Array.from(
      { length: quantidade },
      (_, indice) =>
        (valorBase + (indice < resto ? 1 : 0)) / 100
    );
  }

  function distribuirPorPercentual(
    valorTotal: number,
    percentuais: number[]
  ): number[] {
    const totalCentavos = Math.round(valorTotal * 100);
    const parcelas = percentuais.map((percentual) => {
      const valorExato = (totalCentavos * percentual) / 100;
      const centavos = Math.floor(valorExato);

      return {
        centavos,
        fracao: valorExato - centavos,
      };
    });

    let centavosRestantes = totalCentavos - parcelas.reduce(
      (total, parcela) => total + parcela.centavos,
      0
    );

    const indicesPorFracao = parcelas
      .map((parcela, indice) => ({ indice, fracao: parcela.fracao }))
      .sort((a, b) => b.fracao - a.fracao);

    for (let indice = 0; centavosRestantes > 0; indice += 1) {
      parcelas[indicesPorFracao[indice % parcelas.length].indice].centavos += 1;
      centavosRestantes -= 1;
    }

    return parcelas.map((parcela) => parcela.centavos / 100);
  }

  function validarDivisao(valorNumerico: number): boolean {
    if (participantesSelecionados.length === 0) {
      Alert.alert(
        "Atenção",
        "Selecione pelo menos um participante para dividir a despesa."
      );

      return false;
    }

    if (tipoDivisao === "VALOR") {
      const valores = participantesSelecionados.map((id) =>
        parseCurrencyInput(valoresIndividuais[id] ?? "")
      );

      if (valores.some((item) => !Number.isFinite(item) || item < 0)) {
        Alert.alert(
          "Valores inválidos",
          "Informe um valor válido para cada participante."
        );

        return false;
      }

      const somaCentavos = valores.reduce(
        (soma, item) => soma + Math.round(item * 100),
        0
      );

      if (somaCentavos !== Math.round(valorNumerico * 100)) {
        Alert.alert(
          "Divisão não confere",
          "A soma dos valores individuais deve ser igual ao valor total da despesa."
        );

        return false;
      }
    }

    if (tipoDivisao === "PERCENTUAL") {
      const percentuais = participantesSelecionados.map((id) =>
        Number(
          (percentuaisIndividuais[id] ?? "").replace(",", ".")
        )
      );

      if (
        percentuais.some(
          (item) => !Number.isFinite(item) || item < 0 || item > 100
        )
      ) {
        Alert.alert(
          "Percentuais inválidos",
          "Informe percentuais entre 0 e 100 para cada participante."
        );

        return false;
      }

      const soma = percentuais.reduce(
        (total, item) => total + item,
        0
      );

      if (Math.abs(soma - 100) > 0.01) {
        Alert.alert(
          "Divisão não confere",
          "A soma dos percentuais de todos os participantes precisa ser 100%."
        );

        return false;
      }
    }

    return true;
  }

  async function salvarDespesa() {
    if (salvando) {
      return;
    }

    if (!groupId) {
      Alert.alert(
        "Grupo não identificado",
        "Abra o formulário pela tela de despesas do grupo para continuar."
      );

      return;
    }

    if (!descricaoLimpa) {
      Alert.alert(
        "Atenção",
        "Digite a descrição da despesa."
      );

      return;
    }

    if (
      !valor.trim() ||
      !Number.isFinite(valorNumerico) ||
      valorNumerico <= 0
    ) {
      Alert.alert(
        "Atenção",
        "Digite um valor válido para a despesa."
      );

      return;
    }

    const dataIso = parseDateInputToIso(dataLimpa);
    if (!dataIso) {
      Alert.alert(
        "Data inválida",
        "Informe uma data válida no formato DD/MM/AAAA."
      );

      return;
    }

    if (!validarDivisao(valorNumerico)) {
      return;
    }

    let divisaoCalculada: {
      participanteId: string;
      valor: number;
    }[] = [];

    if (tipoDivisao === "IGUAL") {
      const valoresDivididos = distribuirIgualmente(
        valorNumerico,
        participantesSelecionados.length
      );

      divisaoCalculada = participantesSelecionados.map(
        (participanteId, indice) => ({
          participanteId,
          valor: valoresDivididos[indice],
        })
      );
    }

    if (tipoDivisao === "VALOR") {
      divisaoCalculada = participantesSelecionados.map(
        (participanteId) => ({
          participanteId,
          valor: parseCurrencyInput(
            valoresIndividuais[participanteId] ?? ""
          ),
        })
      );
    }

    if (tipoDivisao === "PERCENTUAL") {
      const percentuais = participantesSelecionados.map((participanteId) =>
        Number(
          (percentuaisIndividuais[participanteId] ?? "0").replace(",", ".")
        )
      );
      const valoresDivididos = distribuirPorPercentual(
        valorNumerico,
        percentuais
      );

      divisaoCalculada = participantesSelecionados.map(
        (participanteId, indice) => ({
          participanteId,
          valor: valoresDivididos[indice],
        })
      );
    }

    const tipoApi = tipoDivisao === "IGUAL" ? "igual" : tipoDivisao === "VALOR" ? "valores" : "porcentagem";
    const valores = Object.fromEntries(divisaoCalculada.map((item) => [item.participanteId, item.valor]));
    const percentuais = Object.fromEntries(participantesSelecionados.map((id) => [id, Number((percentuaisIndividuais[id] ?? "0").replace(",", "."))]));
    setSalvando(true);
    try {
      await despesasGrupoApi.criar({
        grupo_id: Number(groupId), descricao: descricaoLimpa, valor: valorNumerico,
        data_despesa: dataIso, categoria, observacao: observacao.trim(),
        pagador_id: Number(pagadorId),
        participantes: participantesSelecionados.map(Number), divisao_tipo: tipoApi,
        ...(tipoApi === "valores" ? { valores } : {}),
        ...(tipoApi === "porcentagem" ? { percentuais } : {}),
      });
      Alert.alert("Despesa registrada", "A despesa foi dividida e os saldos foram recalculados.", [
        { text: "OK", onPress: () => router.replace({ pathname: "/(main)/group/despesas-grupo", params: { groupId, grupoNome: nomeGrupo } }) },
      ]);
    } catch (erro) {
      Alert.alert("Erro", erro instanceof Error ? erro.message : "Não foi possível registrar a despesa.");
    } finally {
      setSalvando(false);
    }
  }

  const valorPorPessoa =
    Number.isFinite(valorNumerico) &&
    valorNumerico > 0 &&
    participantesSelecionados.length > 0
      ? valorNumerico / participantesSelecionados.length
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={esquema === "dark" ? "light-content" : "dark-content"} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* CABEÇALHO */}

          <View style={styles.header}>
            <TouchableOpacity
              style={styles.botaoVoltar}
              onPress={voltarParaTelaAnterior}
              activeOpacity={0.8}
            >
              <Text style={styles.voltar}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTexto}>
              <Text style={styles.titulo}>
                Nova despesa em grupo
              </Text>

              <Text style={styles.subtitulo}>
                {nomeGrupo}
              </Text>
            </View>
          </View>

          {/* LEITURA DE RECIBO COM IA */}

          <TouchableOpacity
            style={styles.cardIA}
            activeOpacity={0.85}
            onPress={lerRecibo}
          >
            <View style={styles.iconeIA}>
              <Text style={styles.iconeIAText}>📷</Text>
            </View>

            <View style={styles.iaTexto}>
              <Text style={styles.iaTitulo}>
                Ler recibo com foto
              </Text>

              <Text style={styles.iaSubtitulo}>
                Preencha os dados automaticamente com IA
              </Text>
            </View>

            <Text style={styles.seta}>›</Text>
          </TouchableOpacity>

          {/* DESCRIÇÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>Descrição</Text>

            <TextInput
              style={styles.input}
              placeholder="Ex.: Mercado, jantar, hospedagem"
              placeholderTextColor={Cores.placeholder}
              value={descricao}
              onChangeText={setDescricao}
              autoCapitalize="sentences"
              maxLength={120}
            />
          </View>

          {/* VALOR */}

          <View style={styles.campo}>
            <Text style={styles.label}>Valor total</Text>

            <View style={styles.valorContainer}>
              <Text style={styles.simbolo}>R$</Text>

              <TextInput
                style={styles.inputValor}
                placeholder="0,00"
                placeholderTextColor={Cores.placeholder}
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
              />
            </View>

            {tipoDivisao === "IGUAL" &&
              valorNumerico > 0 &&
              participantesSelecionados.length > 0 && (
                <Text style={styles.ajuda}>
                  Divisão igual estimada:{" "}
                  {formatCurrencyBRL(valorPorPessoa)} por pessoa.
                </Text>
              )}
          </View>

          {/* DATA */}

          <View style={styles.campo}>
            <Text style={styles.label}>Data</Text>
            <TouchableOpacity style={styles.seletorData} onPress={() => setMostrarSeletorData(true)} activeOpacity={0.8}>
              <Text style={[styles.textoSeletorData, !data && styles.placeholderSeletorData]}>{data || "Escolher data"}</Text>
            </TouchableOpacity>
            {mostrarSeletorData && (
              <DateTimePicker
                value={parseDateInputToDate(data) ?? new Date()}
                mode="date"
                display="default"
                locale="pt-BR"
                maximumDate={new Date()}
                onChange={selecionarData}
              />
            )}
          </View>

          {/* CATEGORIA */}

          <View style={styles.campo}>
            <Text style={styles.label}>Categoria</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categorias}
            >
              {categorias.map((item) => {
                const selecionada = categoria === item.nome;

                return (
                  <TouchableOpacity
                    key={item.nome}
                    style={[
                      styles.categoria,
                      selecionada && styles.categoriaSelecionada,
                    ]}
                    onPress={() => setCategoria(item.nome)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.categoriaIcone}>
                      {item.icone}
                    </Text>

                    <Text
                      style={[
                        styles.categoriaTexto,
                        selecionada &&
                          styles.categoriaTextoSelecionado,
                      ]}
                    >
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {erroCategorias && <Text style={styles.erroCategorias}>{erroCategorias}</Text>}
          </View>

          {/* QUEM PAGOU */}

          <View style={styles.campo}>
            <Text style={styles.label}>Quem pagou?</Text>

            <Text style={styles.descricaoSecao}>
              Selecione quem realizou o pagamento.
            </Text>

            <View style={styles.listaOpcoes}>
              {participantes.map((participante) => {
                const selecionado = pagadorId === participante.id;

                return (
                  <TouchableOpacity
                    key={participante.id}
                    style={[
                      styles.opcaoPessoa,
                      selecionado && styles.opcaoPessoaSelecionada,
                    ]}
                    onPress={() => setPagadorId(participante.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.avatar,
                        selecionado && styles.avatarSelecionado,
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarTexto,
                          selecionado && styles.avatarTextoSelecionado,
                        ]}
                      >
                        {participante.iniciais}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.nomePessoa,
                        selecionado && styles.nomePessoaSelecionado,
                      ]}
                    >
                      {participante.nome}
                    </Text>

                    <View
                      style={[
                        styles.radio,
                        selecionado && styles.radioSelecionado,
                      ]}
                    >
                      {selecionado && (
                        <View style={styles.radioCentro} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* PARTICIPANTES DA DIVISÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>
              Quem vai dividir a despesa?
            </Text>

            <Text style={styles.descricaoSecao}>
              Toque para incluir ou retirar participantes.
            </Text>

            <View style={styles.listaOpcoes}>
              {participantes.map((participante) => {
                const selecionado =
                  participantesSelecionados.includes(participante.id);

                return (
                  <TouchableOpacity
                    key={participante.id}
                    style={[
                      styles.opcaoPessoa,
                      selecionado && styles.opcaoPessoaSelecionada,
                    ]}
                    onPress={() =>
                      alternarParticipante(participante.id)
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.avatar,
                        selecionado && styles.avatarSelecionado,
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarTexto,
                          selecionado && styles.avatarTextoSelecionado,
                        ]}
                      >
                        {participante.iniciais}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.nomePessoa,
                        selecionado && styles.nomePessoaSelecionado,
                      ]}
                    >
                      {participante.nome}
                    </Text>

                    <View
                      style={[
                        styles.checkbox,
                        selecionado && styles.checkboxSelecionado,
                      ]}
                    >
                      {selecionado && (
                        <Text style={styles.checkTexto}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* TIPO DE DIVISÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>Como dividir o valor?</Text>

            <View style={styles.divisoes}>
              <TouchableOpacity
                style={[
                  styles.divisao,
                  tipoDivisao === "IGUAL" && styles.divisaoSelecionada,
                ]}
                onPress={() => setTipoDivisao("IGUAL")}
                activeOpacity={0.8}
              >
                <Text style={styles.divisaoIcone}>⚖️</Text>

                <Text
                  style={[
                    styles.divisaoTitulo,
                    tipoDivisao === "IGUAL" &&
                      styles.divisaoTituloSelecionado,
                  ]}
                >
                  Igual
                </Text>

                <Text style={styles.divisaoDescricao}>
                  Partes iguais
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.divisao,
                  tipoDivisao === "VALOR" && styles.divisaoSelecionada,
                ]}
                onPress={() => setTipoDivisao("VALOR")}
                activeOpacity={0.8}
              >
                <Text style={styles.divisaoIcone}>💵</Text>

                <Text
                  style={[
                    styles.divisaoTitulo,
                    tipoDivisao === "VALOR" &&
                      styles.divisaoTituloSelecionado,
                  ]}
                >
                  Por valor
                </Text>

                <Text style={styles.divisaoDescricao}>
                  Valor por pessoa
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.divisao,
                  tipoDivisao === "PERCENTUAL" &&
                    styles.divisaoSelecionada,
                ]}
                onPress={() => setTipoDivisao("PERCENTUAL")}
                activeOpacity={0.8}
              >
                <Text style={styles.divisaoIcone}>📊</Text>

                <Text
                  style={[
                    styles.divisaoTitulo,
                    tipoDivisao === "PERCENTUAL" &&
                      styles.divisaoTituloSelecionado,
                  ]}
                >
                  Por %
                </Text>

                <Text style={styles.divisaoDescricao}>
                  Percentual
                </Text>
              </TouchableOpacity>
            </View>

            {/* VALORES INDIVIDUAIS */}

            {tipoDivisao === "VALOR" &&
              participantesSelecionados.length > 0 && (
                <View style={styles.detalhesDivisao}>
                  <Text style={styles.detalhesTitulo}>
                    Valor de cada participante
                  </Text>

                  {participantes.filter((item) =>
                    participantesSelecionados.includes(item.id)
                  ).map((participante) => (
                    <View
                      key={participante.id}
                      style={styles.linhaDivisao}
                    >
                      <Text style={styles.nomeLinha}>
                        {participante.nome}
                      </Text>

                      <View style={styles.valorIndividual}>
                        <Text style={styles.simboloPequeno}>R$</Text>

                        <TextInput
                          style={styles.inputIndividual}
                          placeholder="0,00"
                          placeholderTextColor={Cores.placeholder}
                          value={
                            valoresIndividuais[participante.id] ?? ""
                          }
                          onChangeText={(texto) =>
                            setValoresIndividuais((atuais) => ({
                              ...atuais,
                              [participante.id]: texto,
                            }))
                          }
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

            {/* PERCENTUAIS INDIVIDUAIS */}

            {tipoDivisao === "PERCENTUAL" &&
              participantesSelecionados.length > 0 && (
                <View style={styles.detalhesDivisao}>
                  <Text style={styles.detalhesTitulo}>
                    Percentual de cada participante
                  </Text>

                  {participantes.filter((item) =>
                    participantesSelecionados.includes(item.id)
                  ).map((participante) => (
                    <View
                      key={participante.id}
                      style={styles.linhaDivisao}
                    >
                      <Text style={styles.nomeLinha}>
                        {participante.nome}
                      </Text>

                      <View style={styles.percentualIndividual}>
                        <TextInput
                          style={styles.inputPercentual}
                          placeholder="0"
                          placeholderTextColor={Cores.placeholder}
                          value={
                            percentuaisIndividuais[participante.id] ?? ""
                          }
                          onChangeText={(texto) =>
                            setPercentuaisIndividuais((atuais) => ({
                              ...atuais,
                              [participante.id]: texto,
                            }))
                          }
                          keyboardType="decimal-pad"
                        />

                        <Text style={styles.simboloPercentual}>%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
          </View>

          {/* OBSERVAÇÃO */}

          <View style={styles.campo}>
            <Text style={styles.label}>
              Observação (opcional)
            </Text>

            <TextInput
              style={[styles.input, styles.inputObservacao]}
              placeholder="Adicione uma informação sobre a despesa..."
              placeholderTextColor={Cores.placeholder}
              value={observacao}
              onChangeText={setObservacao}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          {/* BOTÕES */}

          <TouchableOpacity
            style={[styles.botaoSalvar, salvando && { opacity: 0.6 }]}
            onPress={salvarDespesa}
            disabled={salvando}
            activeOpacity={0.85}
          >
            <Text style={styles.botaoSalvarTexto}>
              {salvando ? "Salvando..." : "Salvar despesa"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoCancelar}
            onPress={voltarParaTelaAnterior}
            activeOpacity={0.8}
          >
            <Text style={styles.botaoCancelarTexto}>
              Cancelar
            </Text>
          </TouchableOpacity>

          <View style={styles.espacoFinal} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (Cores: PaletaSemantica) => StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },

  scroll: {
    flex: 1,
  },

  conteudo: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  /* CABEÇALHO */

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 22,
  },

  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  voltar: {
    fontSize: 32,
    color: Cores.texto,
    marginTop: -3,
  },

  headerTexto: {
    flex: 1,
  },

  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: Cores.texto,
  },

  subtitulo: {
    fontSize: 12,
    color: Cores.textoSuave,
    marginTop: 4,
  },

  /* CARTÃO DE LEITURA DE RECIBO */

  cardIA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.superficieVerde,
    borderWidth: 1,
    borderColor: Cores.bordaDestaque,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
  },

  iconeIA: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Cores.cartaoFundo,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  iconeIAText: {
    fontSize: 21,
  },

  iaTexto: {
    flex: 1,
  },

  iaTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 3,
  },

  iaSubtitulo: {
    fontSize: 10,
    color: Cores.textoSuave,
    lineHeight: 15,
  },

  seta: {
    fontSize: 25,
    color: Cores.textoPositivo,
    marginLeft: 8,
  },

  /* CAMPOS */

  campo: {
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Cores.texto,
    marginBottom: 8,
  },

  input: {
    minHeight: 52,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 13,
    paddingHorizontal: 15,
    fontSize: 14,
    color: Cores.texto,
  },
  seletorData: {
    height: 52,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 13,
    paddingHorizontal: 15,
    justifyContent: "center",
  },

  textoSeletorData: { fontSize: 14, color: Cores.texto },
  placeholderSeletorData: { color: Cores.placeholder },

  valorContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 13,
    paddingHorizontal: 15,
  },

  simbolo: {
    fontSize: 14,
    fontWeight: "700",
    color: Cores.texto,
    marginRight: 8,
  },

  inputValor: {
    flex: 1,
    height: "100%",
    fontSize: 18,
    color: Cores.texto,
  },

  ajuda: {
    fontSize: 11,
    lineHeight: 17,
    color: Cores.textoSuave,
    marginTop: 7,
  },

  descricaoSecao: {
    fontSize: 11,
    color: Cores.textoSuave,
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 10,
  },

  categorias: {
    gap: 8,
    paddingRight: 10,
  },
  erroCategorias: { color: Cores.textoErroFormulario, fontSize: 12, marginTop: 6 },

  categoria: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },

  categoriaSelecionada: {
    backgroundColor: Cores.superficieVerdeSelecionada,
    borderColor: Cores.principal,
  },

  categoriaIcone: {
    fontSize: 15,
    marginRight: 5,
  },

  categoriaTexto: {
    fontSize: 11,
    color: Cores.textoSuave,
    fontWeight: "600",
  },

  categoriaTextoSelecionado: {
    color: Cores.texto,
  },

  /* PAGADOR E PARTICIPANTES */

  listaOpcoes: {
    gap: 8,
  },

  opcaoPessoa: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  opcaoPessoaSelecionada: {
    backgroundColor: Cores.superficieVerde,
    borderColor: Cores.principal,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Cores.superficieVerde,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  avatarSelecionado: {
    backgroundColor: Cores.principal,
  },

  avatarTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: Cores.textoSuave,
  },

  avatarTextoSelecionado: {
    color: Cores.textoSobrePrincipal,
  },

  nomePessoa: {
    flex: 1,
    fontSize: 13,
    color: Cores.textoSuave,
    fontWeight: "500",
  },

  nomePessoaSelecionado: {
    color: Cores.texto,
    fontWeight: "700",
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Cores.borda,
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelecionado: {
    borderColor: Cores.principal,
  },

  radioCentro: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Cores.principal,
  },

  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Cores.borda,
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxSelecionado: {
    backgroundColor: Cores.principal,
    borderColor: Cores.principal,
  },

  checkTexto: {
    fontSize: 13,
    fontWeight: "800",
    color: Cores.textoSobreAcao,
  },

  /* TIPOS DE DIVISÃO */

  divisoes: {
    flexDirection: "row",
    gap: 8,
  },

  divisao: {
    flex: 1,
    minHeight: 108,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 13,
    paddingHorizontal: 6,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  divisaoSelecionada: {
    backgroundColor: Cores.superficieVerdeSelecionada,
    borderColor: Cores.principal,
  },

  divisaoIcone: {
    fontSize: 21,
    marginBottom: 7,
  },

  divisaoTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: Cores.textoSuave,
    textAlign: "center",
  },

  divisaoTituloSelecionado: {
    color: Cores.texto,
  },

  divisaoDescricao: {
    fontSize: 9,
    color: Cores.textoSuave,
    marginTop: 5,
    textAlign: "center",
  },

  detalhesDivisao: {
    marginTop: 14,
    padding: 13,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 13,
  },

  detalhesTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: Cores.texto,
    marginBottom: 12,
  },

  linhaDivisao: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
    paddingVertical: 5,
  },

  nomeLinha: {
    flex: 1,
    fontSize: 12,
    color: Cores.texto,
    paddingRight: 8,
  },

  valorIndividual: {
    width: 112,
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 10,
    paddingHorizontal: 8,
  },

  simboloPequeno: {
    color: Cores.textoSuave,
    fontSize: 10,
    fontWeight: "700",
    marginRight: 4,
  },

  inputIndividual: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: Cores.texto,
    textAlign: "right",
  },

  percentualIndividual: {
    width: 78,
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: 10,
    paddingHorizontal: 8,
  },

  inputPercentual: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: Cores.texto,
    textAlign: "right",
  },

  simboloPercentual: {
    color: Cores.textoSuave,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },

  /* OBSERVAÇÃO */

  inputObservacao: {
    minHeight: 100,
    paddingTop: 14,
    paddingBottom: 14,
  },

  /* BOTÕES */

  botaoSalvar: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Cores.principal,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  botaoSalvarTexto: {
    color: Cores.textoSobreAcao,
    fontSize: 15,
    fontWeight: "800",
  },

  botaoCancelar: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Cores.cartaoFundo,
    borderWidth: 1,
    borderColor: Cores.borda,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  botaoCancelarTexto: {
    color: Cores.textoSuave,
    fontSize: 14,
    fontWeight: "700",
  },

  espacoFinal: {
    height: 20,
  },
});
